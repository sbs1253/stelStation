// app/api/sync/channel/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service'; // 서비스 롤 객체
import { parseSyncBody } from '@/lib/validations/sync';
import { SYNC_COOLDOWN_MIN } from '@/lib/config/constants';
import { getUploadsPlaylistId, listPlaylistItems, batchGetVideos } from '@/lib/youtube/client';
import { getChannelLiveStatus } from '@/lib/chzzk/client';

/** 내부 보호: 헤더 시크릿 확인 */
function requireCronSecret(req: Request) {
  const got = req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  return got && expected && got === expected;
}

/** YouTube 동기화: 항상 { payload: [...] } 형태를 반환하도록 일관화 */
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
  const uploads = await getUploadsPlaylistId(platformChannelId);
  if (!uploads) return { payload: [] };

  // recent: 가볍게 1~2p, full: 5p 예시
  const pages = mode === 'recent' ? 2 : 5;

  const allIds: string[] = [];
  let next: string | null | undefined = null;

  for (let i = 0; i < pages; i++) {
    const { ids, nextPageToken } = await listPlaylistItems(uploads, next);
    if (ids?.length) allIds.push(...ids);
    if (!nextPageToken) break;
    next = nextPageToken;
  }

  if (!allIds.length) return { payload: [] };

  // videos.list (최대 200개 한도 예시)
  const metas = await batchGetVideos(allIds.slice(0, 200));
  if (!metas.length) return { payload: [] };

  const payload = metas.map((m) => ({
    platform_video_id: m.id,
    title: m.title,
    thumbnail_url: m.thumbnailUrl ?? null,
    published_at: m.publishedAt, // ISO
    duration_sec: m.durationSec ?? null,
    view_count: m.viewCount ?? null,
    like_count: m.likeCount ?? null,
    content_type: m.contentType, // 'video' | 'short' | 'live' | 'vod'
    is_live: !!m.isLive,
  }));

  return { payload };
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
  const { data: ch, error: chErr } = await supabaseService
    .from('channels')
    .select('id, platform, platform_channel_id, sync_cooldown_until, last_synced_at')
    .eq('id', body.channelId)
    .single();

  if (chErr) {
    return NextResponse.json({ error: 'DB error', details: chErr.message }, { status: 500 });
  }
  if (!ch) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // 3) 쿨타임 체크 (recent 전용 / force면 무시)
  if (!body.force && body.mode === 'recent' && ch.sync_cooldown_until) {
    const until = new Date(ch.sync_cooldown_until);
    if (until > now) {
      return NextResponse.json({ error: 'Cooldown', cooldownUntil: until.toISOString() }, { status: 429 });
    }
  }

  // 4) 플랫폼별 동기화
  const stats = { inserted: 0, updated: 0 };

  try {
    if (ch.platform === 'youtube') {
      // 메타 수집
      const y = await doYoutubeSync(ch.platform_channel_id, body.mode);
      const rows = (y.payload ?? []).map((r) => ({ ...r, channel_id: ch.id }));

      if (rows.length) {
        // platform_video_id unique 기준 upsert
        const up = await supabaseService
          .from('videos_cache')
          .upsert(rows, { onConflict: 'platform_video_id' })
          .select('id');

        if (up.error) throw up.error;
        // 단순화: upsert 결과 행 수를 updated로 카운트
        stats.updated = up.data?.length ?? 0;
      }
    } else if (ch.platform === 'chzzk') {
      // 라이브 상태 보강(치지직은 무료 폴링 기준)
      const live = await getChannelLiveStatus(ch.platform_channel_id);
      const upd = await supabaseService
        .from('channels')
        .update({
          current_live_video_id: live.currentLiveVideoId,
          last_live_ended_at: live.lastLiveEndedAt,
        })
        .eq('id', ch.id);

      if (upd.error) throw upd.error;
    } else {
      return NextResponse.json({ error: 'Unsupported platform', details: ch.platform }, { status: 400 });
    }
  } catch (e: any) {
    // 외부 API/업서트 실패 등
    return NextResponse.json({ error: 'Sync failed', details: String(e?.message ?? e) }, { status: 502 });
  }

  // 5) 채널 상태 갱신 (recent만 쿨타임 부여)
  const cooldownUntil =
    body.mode === 'recent' ? new Date(now.getTime() + SYNC_COOLDOWN_MIN * 60_000).toISOString() : null;

  const { error: updErr } = await supabaseService
    .from('channels')
    .update({
      last_synced_at: nowISO,
      ...(cooldownUntil ? { sync_cooldown_until: cooldownUntil } : {}),
    })
    .eq('id', ch.id);

  if (updErr) {
    return NextResponse.json({ error: 'DB error', details: updErr.message }, { status: 500 });
  }

  // 6) 응답
  return NextResponse.json({
    queued: true,
    mode: body.mode,
    cooldownUntil,
    stats,
  });
}
