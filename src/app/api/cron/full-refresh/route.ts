// app/api/cron/full-refresh/route.ts

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

const CRON_SECRET = process.env.CRON_SECRET!;
const CONCURRENCY = 3; // 동시에 돌릴 채널 수(안전하게 1부터 시작)
const BATCH_DELAY_MS = 400; // 배치 사이 간격(폭주 방지)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  // 0) 내부 보호
  const gotSecret = request.headers.get('x-cron-secret');
  if (!CRON_SECRET || gotSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  // 1) 전체 채널 목록 (오래 안 돌린 채널부터)
  const { data: channels, error: selectError } = await supabaseService
    .from('channels')
    .select('id')
    .order('last_synced_at', { ascending: true, nullsFirst: true });

  if (selectError) {
    return NextResponse.json({ error: 'DB', details: selectError.message }, { status: 500 });
  }
  if (!channels?.length) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      attempted: 0,
      succeeded: 0,
      cooldown: 0,
      failed: 0,
      failReasons: {},
    });
  }

  // 실패 사유 집계용
  const failReasons: Record<string, number> = {};

  // 2) 개별 채널 동기화 헬퍼 (sync/channel 호출)
  async function syncOneChannel(channelId: string): Promise<'ok' | 'cooldown' | 'fail'> {
    try {
      const response = await fetch(`${origin}/api/sync/channel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-secret': CRON_SECRET, // 내부 보호
        },
        body: JSON.stringify({ channelId, mode: 'full' }),
      });

      // 설계상 full 모드는 쿨타임을 보지 않지만,
      // 혹시 429가 오면 쿨다운으로 집계
      if (response.status === 429) return 'cooldown';
      if (!response.ok) {
        try {
          const text = await response.text();
          const json = JSON.parse(text);
          const reason = json?.details || json?.error || String(response.status);
          failReasons[reason] = (failReasons[reason] || 0) + 1;
        } catch {
          const reason = String(response.status);
          failReasons[reason] = (failReasons[reason] || 0) + 1;
        }
        return 'fail';
      }
      return 'ok';
    } catch (error: any) {
      const reason = error?.message ? String(error.message) : 'fetch_failed';
      failReasons[reason] = (failReasons[reason] || 0) + 1;
      return 'fail';
    }
  }

  // 3) 동시성 제한 루프
  let attempted = 0;
  let succeeded = 0;
  let cooldown = 0;
  let failed = 0;

  for (let i = 0; i < channels.length; i += CONCURRENCY) {
    const batch = channels.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(batch.map((channel) => syncOneChannel(channel.id)));

    for (const result of results) {
      attempted++;
      const value = result.status === 'fulfilled' ? result.value : 'fail';
      if (value === 'ok') succeeded++;
      else if (value === 'cooldown') cooldown++;
      else failed++;
    }

    // 다음 배치 전 잠깐 쉬기(유튜브 QPS 완화)
    if (i + CONCURRENCY < channels.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return NextResponse.json({
    ok: true,
    processed: attempted, // 과거 응답 호환성
    attempted,
    succeeded,
    cooldown, // full에선 일반적으로 0(쿨타임 미적용 설계)
    failed,
    failReasons, // 실패 사유 집계
  });
}
