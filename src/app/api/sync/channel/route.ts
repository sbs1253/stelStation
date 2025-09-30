import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { parseSyncBody } from '@/lib/validations/sync';
import { SYNC_COOLDOWN_MIN } from '@/lib/config/constants';
import { getUploadsPlaylistId, listPlaylistItems, batchGetVideos, getYoutubeChannelMeta } from '@/lib/youtube/client';
import {
  getChzzkChannelMeta,
  getChzzkLiveStatus,
  getChzzkVideosPage,
  mapChzzkVideoToCacheRow,
} from '@/lib/chzzk/client';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  throw new Error('CRON_SECRET is not configured');
}

/** 내부 보호: 헤더 시크릿 확인 */
function requireCronSecret(req: Request) {
  return req.headers.get('x-cron-secret') === CRON_SECRET;
}

/** 현재 시각(KST) */
function kstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

/** KST 기준 120일 컷오프 시각 */
function kstCutoff120d(): Date {
  const d = kstNow();
  d.setDate(d.getDate() - 120);
  return d;
}

/**
 * YouTube 동기화
 * - recent: 최신 페이지(1p)만 조회해 신규 업로드 유무 체크(저렴)
 * - full  : KST 120일 창을 만족할 때까지 페이지네이션(안전 상한 존재)
 */
async function doYoutubeSync(
  platformChannelId: string,
  mode: 'recent' | 'full'
): Promise<{
  payload: Array<{
    platform_video_id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string; // ISO
    duration_sec: number | null;
    view_count: number | null;
    like_count: number | null;
    content_type: 'video' | 'short' | 'live' | 'vod';
    is_live: boolean;
  }>;
}> {
  const uploadsPlaylistId = await getUploadsPlaylistId(platformChannelId);
  if (!uploadsPlaylistId) return { payload: [] };

  const cutoffDateKST = kstCutoff120d();

  // 최근/전체 모드별 페이지 상한
  const RECENT_PAGES = 1;
  const FULL_PAGES_MAX = 5; // 대부분 컷오프 만나기 전 종료
  const maxPages = mode === 'recent' ? RECENT_PAGES : FULL_PAGES_MAX;

  let nextPageToken: string | null | undefined = null;
  const collectedRows: Array<{
    platform_video_id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string;
    duration_sec: number | null;
    view_count: number | null;
    like_count: number | null;
    content_type: 'video' | 'short' | 'live' | 'vod';
    is_live: boolean;
  }> = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const { ids: videoIds, nextPageToken: nextToken } = await listPlaylistItems(uploadsPlaylistId, nextPageToken);
    if (!videoIds?.length) break;

    // 이 페이지의 상세 메타
    const videoMetas = await batchGetVideos(videoIds);

    // 컷오프 이상만 적재
    const filteredMetas = videoMetas.filter((meta) => new Date(meta.publishedAt) >= cutoffDateKST);

    // 업서트 스키마로 매핑
    for (const meta of filteredMetas) {
      collectedRows.push({
        platform_video_id: meta.id,
        title: meta.title,
        thumbnail_url: meta.thumbnailUrl ?? null,
        published_at: meta.publishedAt,
        duration_sec: meta.durationSec ?? null,
        view_count: meta.viewCount ?? null,
        like_count: meta.likeCount ?? null,
        content_type: meta.contentType,
        is_live: !!meta.isLive,
      });
    }

    // full 모드: 이 페이지에서 컷오프 이상이 하나도 없었으면 아래로 더 내려갈 필요 없음
    if (mode === 'full' && filteredMetas.length === 0) break;

    // 다음 페이지 준비
    if (!nextToken) break;
    nextPageToken = nextToken;
  }

  return { payload: collectedRows };
}

export async function POST(request: Request) {
  // 0) 내부 보호
  if (!requireCronSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 1) 입력 파싱 (zod)
  let body: { channelId: string; mode: 'recent' | 'full'; force?: boolean };
  try {
    body = parseSyncBody(await request.json());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  const operationStartedAt = new Date(); // duration 계산용

  // 2) 채널 조회 (DB 내부 uuid)
  const { data: channelRecord, error: channelSelectError } = await supabaseService
    .from('channels')
    .select(
      'id, platform, platform_channel_id, sync_cooldown_until, last_synced_at, last_live_ended_at, title, thumbnail_url'
    )
    .eq('id', body.channelId)
    .single();

  if (channelSelectError) {
    return NextResponse.json(
      { ok: false, error: 'DB', message: 'DB error', details: channelSelectError.message },
      { status: 500 }
    );
  }
  if (!channelRecord) {
    return NextResponse.json({ ok: false, error: 'NOT_FOUND', message: 'Channel not found' }, { status: 404 });
  }

  const now = new Date();
  

  // 3) 쿨타임 체크 (recent 전용 / force면 무시)
  if (!body.force && body.mode === 'recent' && channelRecord.sync_cooldown_until) {
    const cooldownUntilDate = new Date(channelRecord.sync_cooldown_until);
    if (cooldownUntilDate > now) {
      return NextResponse.json(
        { ok: false, error: 'COOLDOWN', message: 'Cooldown', cooldownUntil: cooldownUntilDate.toISOString() },
        { status: 429 }
      );
    }
  }

  // 집계 통계: 외부에서 가져온 개수(fetched) / DB upsert된 개수(upserted)
  const stats = { fetched: 0, upserted: 0 } as { fetched: number; upserted: number };

  // 4) 플랫폼별 동기화
  try {
    if (channelRecord.platform === 'youtube') {
      // (A) 채널 메타 갱신: 제목/썸네일이 비어있거나 바뀌었으면 업데이트
      try {
        const meta = await getYoutubeChannelMeta(channelRecord.platform_channel_id);
        if (meta) {
          const updates: Record<string, any> = {};
          if (meta.title && meta.title !== channelRecord.title) {
            updates.title = meta.title;
          }
          if (meta.thumbnailUrl && meta.thumbnailUrl !== channelRecord.thumbnail_url) {
            updates.thumbnail_url = meta.thumbnailUrl;
          }
          if (Object.keys(updates).length) {
            const r = await supabaseService.from('channels').update(updates).eq('id', channelRecord.id);
            if (r.error) throw r.error;
          }
        }
      } catch (e) {
        console.error('[youtube] channel meta refresh skipped', e);
      }
      // YouTube 메타 수집
      const youtubeSyncResult = await doYoutubeSync(channelRecord.platform_channel_id, body.mode);

      // (이중안전) 컷오프 필터
      const cutoffKST = kstCutoff120d();
      const rowsForUpsert = (youtubeSyncResult.payload ?? [])
        .filter((row) => new Date(row.published_at) >= cutoffKST)
        .map((row) => ({ ...row, channel_id: channelRecord.id }));

      stats.fetched = rowsForUpsert.length;

      if (rowsForUpsert.length) {
        const upsertResult = await supabaseService
          .from('videos_cache')
          .upsert(rowsForUpsert, { onConflict: 'platform_video_id' })
          .select('id');

        if (upsertResult.error) throw upsertResult.error;
        stats.upserted = upsertResult.data?.length ?? 0;
      }
    } else if (channelRecord.platform === 'chzzk') {
      // 1) 라이브 상태(실시간)
      const liveStatus = await getChzzkLiveStatus(channelRecord.platform_channel_id);
      const isLiveNow = !!liveStatus?.openLive;

      // 2) 채널 메타(제목/썸네일) 갱신
      const channelMeta = await getChzzkChannelMeta(channelRecord.platform_channel_id).catch(() => null);
      if (channelMeta) {
        const metaUpdates: Record<string, any> = {};
        if (channelMeta.channelName && channelMeta.channelName !== channelRecord.title) {
          metaUpdates.title = channelMeta.channelName;
        }
        if (channelMeta.channelImageUrl && channelMeta.channelImageUrl !== channelRecord.thumbnail_url) {
          metaUpdates.thumbnail_url = channelMeta.channelImageUrl;
        }
        if (Object.keys(metaUpdates).length) {
          const updateResult = await supabaseService.from('channels').update(metaUpdates).eq('id', channelRecord.id);
          if (updateResult.error) throw updateResult.error;
        }
      }

      // 3) 라이브 상태 전이 기록
      const d = liveStatus?.liveDetail;
      const payload = {
        liveId: d?.liveId != null ? String(d.liveId) : null,
        title: d?.liveTitle ?? null,
        thumbnail: d?.liveImageUrl ?? null,
        concurrentUserCount: d?.concurrentUserCount ?? null,
        category: d?.categoryType ?? null,
        chatChannelId: d?.chatChannelId ?? null,
        openDate: d?.openDate ?? null, // "yyyy-MM-dd HH:mm:ss" (KST 문자열)
        closeDate: d?.closeDate ?? null, // 종료 시각 (있으면)
      };
      const { error: liveStateRpcError } = await supabaseService.rpc('rpc_update_channel_live_state', {
        p_channel_id: channelRecord.id,
        p_is_live_now: isLiveNow,
        p_live_data: payload,
      });
      if (liveStateRpcError) throw liveStateRpcError;

      // 4) (옵션) VOD 수집 — 현재는 항상 수행(true). 정책 변경 시 토글.
      const shouldFetchVod = true;
      if (shouldFetchVod) {
        const pagesToFetch = body.mode === 'recent' ? 1 : 5;

        // API가 limit을 무시하고 size=30을 돌려주는 케이스 대비
        const requestLimit = 20;
        let offset = 0;

        // 중복 방지(페이지 간 겹침 대비)
        const seenPlatformIds = new Set<string>();

        // 임시 수집 버퍼
        const collectedRows: any[] = [];

        const cutoffMs = kstCutoff120d().getTime();
        let reachedCutoff = false;

        for (let page = 0; page < pagesToFetch && !reachedCutoff; page++) {
          const { items } = await getChzzkVideosPage(channelRecord.platform_channel_id, requestLimit, offset);
          if (!items.length) break;

          for (const item of items) {
            // 게시 시각 계산: publishDateAt(밀리초) 우선, 없으면 KST 문자열 파싱
            const publishedTimestampMs =
              typeof item.publishDateAt === 'number'
                ? item.publishDateAt
                : item.publishDate
                ? Date.parse(item.publishDate.replace(' ', 'T') + '+09:00')
                : Date.now();

            // 120일 컷오프(정렬: 최신→과거 전제)
            if (publishedTimestampMs < cutoffMs) {
              reachedCutoff = true;
              break;
            }

            // 이 항목의 platform_video_id 계산(맵퍼와 동일 규칙)
            const platformVideoId = `chzzk:${item.videoId}`;
            if (seenPlatformIds.has(platformVideoId)) {
              continue; // 같은 배치 내 중복 방지
            }
            seenPlatformIds.add(platformVideoId);

            collectedRows.push(mapChzzkVideoToCacheRow(channelRecord.id, item));
          }

          // offset은 실제 응답 길이에 맞춰 증가(겹침 방지)
          offset += items.length;
        }

        // 업서트 직전 컷오프/중복 제거(이중 안전망)
        if (collectedRows.length) {
          const cutoffDate = kstCutoff120d();

          // 1) 컷오프 필터
          const withinCutoff = collectedRows.filter((r) => new Date(r.published_at) >= cutoffDate);

          if (withinCutoff.length) {
            // 2) 충돌키 기준 중복 제거
            const deduplicatedMap = new Map<string, (typeof withinCutoff)[number]>();
            for (const row of withinCutoff) {
              // 정책상 마지막 값을 남김
              deduplicatedMap.set(row.platform_video_id, row);
            }
            const uniqueRows = Array.from(deduplicatedMap.values());

            // 집계(본 실행에서 업서트 대상으로 모은 개수)
            stats.fetched = uniqueRows.length;

            // 대용량 대비 배치 업서트
            const UPSERT_BATCH_SIZE = 500;
            for (let i = 0; i < uniqueRows.length; i += UPSERT_BATCH_SIZE) {
              const batchSlice = uniqueRows.slice(i, i + UPSERT_BATCH_SIZE);
              const upsertResult = await supabaseService
                .from('videos_cache')
                .upsert(batchSlice, { onConflict: 'platform_video_id' })
                .select('id');
              if (upsertResult.error) throw upsertResult.error;
              stats.upserted += upsertResult.data?.length ?? 0;
            }
          }
        }
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'UNSUPPORTED_PLATFORM', message: 'Unsupported platform', details: channelRecord.platform },
        { status: 400 }
      );
    }
  } catch (e: any) {
    // 외부 API/업서트 실패 등
    return NextResponse.json(
      { ok: false, error: 'SYNC_FAILED', message: 'Sync failed', details: String(e?.message ?? e) },
      { status: 502 }
    );
  }

  // 5) 채널 상태 갱신 (recent만 쿨타임 부여)
  const cooldownUntilISO =
    body.mode === 'recent' ? new Date(Date.now() + SYNC_COOLDOWN_MIN * 60_000).toISOString() : null;

  const { error: channelUpdateError } = await supabaseService
    .from('channels')
    .update({
      last_synced_at: new Date().toISOString(),
      ...(cooldownUntilISO ? { sync_cooldown_until: cooldownUntilISO } : {}),
    })
    .eq('id', channelRecord.id);

  if (channelUpdateError) {
    return NextResponse.json(
      { ok: false, error: 'DB', message: 'DB error', details: channelUpdateError.message },
      { status: 500 }
    );
  }

  // 6) 응답
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - operationStartedAt.getTime();

  return NextResponse.json({
    ok: true,
    queued: true,
    mode: body.mode,
    channelId: channelRecord.id,
    platform: channelRecord.platform,
    startedAt: operationStartedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    cooldownUntil: cooldownUntilISO,
    stats,
  });
}
