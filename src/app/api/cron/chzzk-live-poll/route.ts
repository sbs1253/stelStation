import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { getChzzkLiveStatus } from '@/lib/chzzk/client';

const CRON_SECRET = process.env.CRON_SECRET!;
const CONCURRENCY = 4; // chzzk는 무료 폴링이라 3~6 권장
const BATCH_DELAY_MS = 200; // 배치 간 짧게 쉬어줌
const STALE_MINUTES_DEFAULT = 3;

export async function POST(request: Request) {
  if ((request.headers.get('x-cron-secret') ?? '') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const staleMin = Number(url.searchParams.get('staleMin') ?? STALE_MINUTES_DEFAULT);

  // 1) chzzk 채널 중, live_state_updated_at 이 오래된 것만 골라오기(스케줄 최적화)
  const { data: channels, error } = await supabaseService
    .from('channels')
    .select('id, platform, platform_channel_id, live_state_updated_at, last_live_ended_at')
    .eq('platform', 'chzzk')
    .order('live_state_updated_at', { ascending: true, nullsFirst: true });

  if (error) return NextResponse.json({ error: 'DB', details: error.message }, { status: 500 });

  const cutoff = Date.now() - staleMin * 60_000;
  const targets = (channels ?? []).filter((c) => {
    const last = c.live_state_updated_at ? new Date(c.live_state_updated_at).getTime() : 0;
    return last < cutoff; // 오래된 것만
  });

  if (!targets.length) {
    return NextResponse.json({ ok: true, attempted: 0, updated: 0 });
  }

  let attempted = 0;
  let updated = 0;
  const failReasons: Record<string, number> = {};

  async function pollOne(ch: any) {
    attempted++;
    try {
      const live = await getChzzkLiveStatus(ch.platform_channel_id);
      const isLiveNow = !!live?.openLive;
      const { error: liveRpcErr } = await supabaseService.rpc('rpc_channels_apply_live_state', {
        p_channel_id: ch.id,
        p_is_live_now: isLiveNow,
        p_now: new Date().toISOString(),
      });
      // RPC 에러는 failReasons 집계(객체 누적)로 기록하고 이 채널은 스킵
      if (liveRpcErr) {
        const key = liveRpcErr.message ?? 'rpc_channels_apply_live_state';
        failReasons[key] = (failReasons[key] ?? 0) + 1;
        return;
      }
      // 상태 전이는 RPC가 원자적으로 처리하므로 별도 channels.update 불필요
      updated++;
    } catch (e: any) {
      const key = String(e?.message ?? e);
      failReasons[key] = (failReasons[key] ?? 0) + 1;
    }
  }

  // 동시성 제한 처리
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(pollOne));
    if (i + CONCURRENCY < targets.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return NextResponse.json({ ok: true, attempted, updated, failReasons });
}
