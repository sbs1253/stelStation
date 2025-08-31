export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service'; // 서버 전용 객체 (service role)
import { parseSyncBody } from '@/lib/validations/sync';
import { SYNC_COOLDOWN_MIN } from '@/lib/config/constants';

function requireCronSecret(req: Request) {
  const got = req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  return got && expected && got === expected;
}

export async function POST(request: Request) {
  // 0) 내부 보호
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1) 입력 파싱
  let body: { channelId: string; mode: 'recent' | 'full'; force?: boolean };
  try {
    body = parseSyncBody(await request.json());
    console.log(body);
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  // 2) 채널 조회
  const { data: ch, error: chErr } = await supabaseService
    .from('channels')
    .select('id, platform, platform_channel_id, sync_cooldown_until, last_synced_at')
    .eq('id', body.channelId)
    .single();

  if (chErr) return NextResponse.json({ error: 'DB error', details: chErr.message }, { status: 500 });
  if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  if (ch.platform !== 'youtube') {
    return NextResponse.json({ error: 'Unsupported platform', details: ch.platform }, { status: 400 });
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // 3) 쿨타임 체크
  if (!body.force && body.mode === 'recent' && ch.sync_cooldown_until) {
    const until = new Date(ch.sync_cooldown_until);
    if (until > now) {
      return NextResponse.json({ error: 'Cooldown', cooldownUntil: until.toISOString() }, { status: 429 });
    }
  }

  // (옵션) full 주기 제한을 두고 싶다면 활성화
  // if (!body.force && body.mode === 'full' && ch.last_synced_at) {
  //   const last = new Date(ch.last_synced_at);
  //   if (now.getTime() - last.getTime() < FULL_COOLDOWN_HOURS * 3600_000) {
  //     return NextResponse.json({ error: 'Full sync recently done' }, { status: 429 });
  //   }
  // }

  // 4) YouTube 호출 (MVP 스텁) — 나중에 실제 구현만 끼워 넣으면 됨
  // TODO:
  //  - uploads playlist id 조회
  //  - playlistItems로 최근 ID 수집 (mode=recent면 1~2페이지, full이면 더 많이)
  //  - videos.list(최대 50개 배치)로 메타/통계 조회
  //  - videos_cache upsert

  const stats = { inserted: 0, updated: 0 }; // 지금은 스텁

  // 5) 채널 상태 갱신
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

  // 6) 응답 — 202 Accepted 느낌으로
  return NextResponse.json({
    queued: true,
    mode: body.mode,
    cooldownUntil,
    stats,
  });
}
