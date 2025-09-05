import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service'; // 서비스 롤 객체
import { parseSyncBody } from '@/lib/validations/sync';
import { SYNC_COOLDOWN_MIN } from '@/lib/config/constants';
import { getUploadsPlaylistId, listPlaylistItems, batchGetVideos } from '@/lib/youtube/client';
import {
  getChzzkChannelMeta,
  getChzzkLiveStatus,
  getChzzkVideosPage,
  mapChzzkVideoToCacheRow,
} from '@/lib/chzzk/client';

/** 내부 보호: 헤더 시크릿 확인 */
function requireCronSecret(req: Request) {
  const got = req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  return got && expected && got === expected;
}

/** KST now */
function kstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

/** KST 기준 120일 컷오프 */
function kstCutoff120d(): Date {
  const d = kstNow();
  d.setDate(d.getDate() - 120);
  return d;
}

/** YouTube 동기화: recent=최신만(저렴), full=KST 120일 창 보장(깊게) */
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

  // recent: 1페이지만 (최신 업로드 유무 확인용, 쿼터 최소)
  // full  : 컷오프에 닿을 때까지 페이지네이션(안전 상한 pages도 존재)
  const PAGES_RECENT = 1;
  const PAGES_FULL_MAX = 5; // 안전 상한 (대부분 컷오프 만나기 전에 종료됨)
  const maxPages = mode === 'recent' ? PAGES_RECENT : PAGES_FULL_MAX;

  let nextPageToken: string | null | undefined = null;
  const collected: Array<{
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

  for (let page = 0; page < maxPages; page++) {
    const { ids, nextPageToken: np } = await listPlaylistItems(uploadsPlaylistId, nextPageToken);
    if (!ids?.length) break;

    // 이 페이지의 상세 메타
    const metas = await batchGetVideos(ids);

    // 컷오프 이상만 적재
    const filtered = metas.filter((m) => new Date(m.publishedAt) >= cutoffDateKST);

    // 매핑(업서트 스키마와 동일)
    for (const m of filtered) {
      collected.push({
        platform_video_id: m.id,
        title: m.title,
        thumbnail_url: m.thumbnailUrl ?? null,
        published_at: m.publishedAt,
        duration_sec: m.durationSec ?? null,
        view_count: m.viewCount ?? null,
        like_count: m.likeCount ?? null,
        content_type: m.contentType,
        is_live: !!m.isLive,
      });
    }

    // full 모드: 이 페이지에서 컷오프 이상이 하나도 없었으면 더 내려갈 필요 없음(종료)
    if (mode === 'full' && filtered.length === 0) break;

    // 다음 페이지 준비
    if (!np) break;
    nextPageToken = np;
  }

  return { payload: collected };
}

export async function POST(request: Request) {
  // 0) 내부 보호
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1) 입력 파싱 (zod)
  let body: { channelId: string; mode: 'recent' | 'full'; force?: boolean };
  try {
    body = parseSyncBody(await request.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  // 2) 채널 조회 (DB의 내부 uuid로 찾음)
  const { data: channelRecord, error: channelSelectError } = await supabaseService
    .from('channels')
    .select(
      'id, platform, platform_channel_id, sync_cooldown_until, last_synced_at, current_live_video_id, last_live_ended_at, title, thumbnail_url'
    )
    .eq('id', body.channelId)
    .single();

  if (channelSelectError) {
    return NextResponse.json({ error: 'DB error', details: channelSelectError.message }, { status: 500 });
  }
  if (!channelRecord) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // 3) 쿨타임 체크 (recent 전용 / force면 무시)
  if (!body.force && body.mode === 'recent' && channelRecord.sync_cooldown_until) {
    const until = new Date(channelRecord.sync_cooldown_until);
    if (until > now) {
      return NextResponse.json({ error: 'Cooldown', cooldownUntil: until.toISOString() }, { status: 429 });
    }
  }

  // 4) 플랫폼별 동기화
  const stats = { inserted: 0, updated: 0 };

  try {
    if (channelRecord.platform === 'youtube') {
      // 메타 수집
      const yt = await doYoutubeSync(channelRecord.platform_channel_id, body.mode);

      // (이중안전) 컷오프 필터
      const cutoffKST = kstCutoff120d();
      const rows = (yt.payload ?? [])
        .filter((r) => new Date(r.published_at) >= cutoffKST)
        .map((r) => ({ ...r, channel_id: channelRecord.id }));

      if (rows.length) {
        const upsertRes = await supabaseService
          .from('videos_cache')
          .upsert(rows, { onConflict: 'platform_video_id' })
          .select('id');

        if (upsertRes.error) throw upsertRes.error;
        stats.updated = upsertRes.data?.length ?? 0;
      }
    } else if (channelRecord.platform === 'chzzk') {
      // ---------- CHZZK 분기: 라이브 상태 + 메타 + VOD 동기화  ----------

      // 1) 라이브 상태(실시간)
      const live = await getChzzkLiveStatus(channelRecord.platform_channel_id);
      const wasLive = !!channelRecord.current_live_video_id;
      const isLiveNow = !!live?.openLive;

      // 2) 채널 메타(이름/썸네일)
      let newTitle: string | null | undefined = undefined;
      let newThumb: string | null | undefined = undefined;

      try {
        const meta = await getChzzkChannelMeta(channelRecord.platform_channel_id);
        if (meta) {
          if (meta.channelName && meta.channelName !== channelRecord.title) newTitle = meta.channelName;
          if (meta.channelImageUrl && meta.channelImageUrl !== channelRecord.thumbnail_url)
            newThumb = meta.channelImageUrl;
        }
      } catch {
        // 메타 갱신은 실패해도 치명적이지 않으니 무시
      }

      // 3) 상태 전이 및 메타 변경사항 수집
      const updates: Record<string, any> = {};
      if (isLiveNow && !wasLive) {
        // 라이브 시작
        // updates.current_live_video_id = `chzzk:${channelRecord.platform_channel_id}:live`;
        updates.last_live_ended_at = null;
      } else if (!isLiveNow && wasLive) {
        // 라이브 종료
        // updates.current_live_video_id = null;
        updates.last_live_ended_at = new Date().toISOString();
      }

      if (newTitle !== undefined) updates.title = newTitle;
      if (newThumb !== undefined) updates.thumbnail_url = newThumb;

      // 4) 채널 정보 업데이트 (변경사항이 있을 경우에만)
      if (Object.keys(updates).length > 0) {
        const upd = await supabaseService.from('channels').update(updates).eq('id', channelRecord.id);
        if (upd.error) throw upd.error;
      }

      // 5) VOD 수집
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
            const publishedMs =
              typeof item.publishDateAt === 'number'
                ? item.publishDateAt
                : item.publishDate
                ? Date.parse(item.publishDate.replace(' ', 'T') + '+09:00')
                : Date.now();

            // 120일 컷오프: 정렬이 최신→과거라는 전제에서 조기 종료
            if (publishedMs < cutoffMs) {
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

        // 이중 안전망: 업서트 직전에도 컷오프/중복 제거
        if (collectedRows.length) {
          const cutoffDate = kstCutoff120d();
          // 1) 컷오프 필터
          const withinCutoff = collectedRows.filter((r) => new Date(r.published_at) >= cutoffDate);
          if (withinCutoff.length) {
            // 2) 같은 배치 내 중복 제거(충돌키 기준)
            const dedupMap = new Map<string, (typeof withinCutoff)[number]>();
            for (const row of withinCutoff) {
              dedupMap.set(row.platform_video_id, row); // 마지막 값을 남길지, 처음 값을 남길지는 정책 선택
            }
            const uniqueRows = Array.from(dedupMap.values());

            // 배치 분할 — 아주 큰 배치에서 안정성 높이고 싶다면 사용
            const BATCH_SIZE = 500;
            for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
              const slice = uniqueRows.slice(i, i + BATCH_SIZE);
              const upsertResult = await supabaseService
                .from('videos_cache')
                .upsert(slice, { onConflict: 'platform_video_id' })
                .select('id');
              if (upsertResult.error) throw upsertResult.error;
              stats.updated += upsertResult.data?.length ?? 0;
            }
          }
        }
      }
    } else {
      return NextResponse.json({ error: 'Unsupported platform', details: channelRecord.platform }, { status: 400 });
    }
  } catch (e: any) {
    // 외부 API/업서트 실패 등
    return NextResponse.json({ error: 'Sync failed', details: String(e?.message ?? e) }, { status: 502 });
  }

  // 5) 채널 상태 갱신 (recent만 쿨타임 부여)
  const cooldownUntil =
    body.mode === 'recent' ? new Date(now.getTime() + SYNC_COOLDOWN_MIN * 60_000).toISOString() : null;

  const { error: channelUpdateError } = await supabaseService
    .from('channels')
    .update({
      last_synced_at: nowISO,
      ...(cooldownUntil ? { sync_cooldown_until: cooldownUntil } : {}),
    })
    .eq('id', channelRecord.id);

  if (channelUpdateError) {
    return NextResponse.json({ error: 'DB error', details: channelUpdateError.message }, { status: 500 });
  }

  // 6) 응답
  return NextResponse.json({
    queued: true,
    mode: body.mode,
    cooldownUntil,
    stats,
  });
}
