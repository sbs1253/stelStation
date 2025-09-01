// app/api/cron/full-refresh/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

const CRON_SECRET = process.env.CRON_SECRET!;
const CONCURRENCY = 3; // 동시에 돌릴 채널 수
const BATCH_DELAY_MS = 400; // 배치 사이 간격(폭주 방지)

export async function POST(request: Request) {
  // 0) 내부 보호
  const got = request.headers.get('x-cron-secret');
  if (!CRON_SECRET || got !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  // 1) 전체 채널 목록 (오래 안 돌린 채널부터)
  const { data: channels, error } = await supabaseService
    .from('channels')
    .select('id')
    .order('last_synced_at', { ascending: true, nullsFirst: true });

  if (error) return NextResponse.json({ error: 'DB', details: error.message }, { status: 500 });
  if (!channels?.length)
    return NextResponse.json({ ok: true, processed: 0, attempted: 0, succeeded: 0, cooldown: 0, failed: 0 });

  // 2) 개별 채널 동기화 헬퍼 (sync/channel 호출)
  async function syncOne(channelId: string): Promise<'ok' | 'cooldown' | 'fail'> {
    try {
      const res = await fetch(`${origin}/api/sync/channel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // sync/channel도 시크릿을 요구하므로 반드시 전달
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ channelId, mode: 'full' }),
      });

      // NOTE: 우리 설계상 full 모드는 쿨타임을 보지 않습니다(의도된 동작).
      // 그래도 혹시 429가 온다면 쿨타임 카운팅.
      if (res.status === 429) return 'cooldown';
      if (!res.ok) return 'fail';
      return 'ok';
    } catch {
      return 'fail';
    }
  }

  // 3) 동시성 제한 루프
  let attempted = 0,
    succeeded = 0,
    cooldown = 0,
    failed = 0;

  for (let i = 0; i < channels.length; i += CONCURRENCY) {
    const batch = channels.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(batch.map((ch) => syncOne(ch.id)));

    for (const r of results) {
      attempted++;
      const val = r.status === 'fulfilled' ? r.value : 'fail';
      if (val === 'ok') succeeded++;
      else if (val === 'cooldown') cooldown++;
      else failed++;
    }

    if (i + CONCURRENCY < channels.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return NextResponse.json({
    ok: true,
    processed: attempted, // 과거 응답 호환성
    attempted,
    succeeded,
    cooldown, // full에선 일반적으로 0(쿨타임 미적용 설계)
    failed,
  });
}
