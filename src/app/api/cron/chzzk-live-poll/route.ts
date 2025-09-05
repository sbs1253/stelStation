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
  const origin = url.origin;

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

      // 전이 판단: we don’t rely on current_live_video_id for chzzk
      const updates: Record<string, any> = {
        live_state_updated_at: new Date().toISOString(),
      };

      // 종료 전이: 이전 종료시각 이후로 live가 꺼졌다면 종료 시각 갱신
      // 시작 전이: “최근 종료 시각이 현재 상태갱신보다 과거이고, isLiveNow true면” 시작으로 간주해도 되지만
      // 정확한 시작 시각을 별도로 두고 싶으면 last_live_started_at 컬럼을 추가 추천.
      if (isLiveNow) {
        // 시작으로 간주 / 진행 중 (chzzk는 current_live_video_id 채우지 않음)
        // updates.last_live_started_at = new Date().toISOString(); // 컬럼이 있다면
      } else {
        // 종료로 간주
        updates.last_live_ended_at = new Date().toISOString();
      }

      const upd = await supabaseService.from('channels').update(updates).eq('id', ch.id);
      if (upd.error) throw upd.error;
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
