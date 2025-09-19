import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { getChzzkLiveStatus } from '@/lib/chzzk/client';

const CRON_SECRET = process.env.CRON_SECRET!;

// 기본 튜닝값(쿼리 파라미터로 오버라이드 가능)
const DEFAULT_CONCURRENCY = 4; // chzzk는 무료 폴링이라 3~6 권장
const DEFAULT_BATCH_DELAY_MS = 200; // 배치 간 짧게 쉬어줌
const DEFAULT_STALE_MINUTES = 3; // 이 분 이상 지난 대상만 폴링

type ChzzkChannelRow = {
  id: string;
  platform: 'chzzk';
  platform_channel_id: string;
  is_live_now: boolean | null;
  live_state_updated_at: string | null;
  last_live_started_at: string | null;
  last_live_ended_at: string | null;
};

export async function POST(request: Request) {
  // 0) 내부 보호
  if ((request.headers.get('x-cron-secret') ?? '') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();

  // 1) 입력 파라미터 파싱(테스트/운영 튜닝용)
  const url = new URL(request.url);
  const staleMin = Number(url.searchParams.get('staleMin') ?? DEFAULT_STALE_MINUTES);
  const concurrency = Math.max(1, Number(url.searchParams.get('concurrency') ?? DEFAULT_CONCURRENCY));
  const batchDelayMs = Math.max(0, Number(url.searchParams.get('batchDelayMs') ?? DEFAULT_BATCH_DELAY_MS));
  const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null;
  const verbose = (url.searchParams.get('verbose') ?? '') === '1';
  const dryRun = (url.searchParams.get('dryRun') ?? '') === '1';

  // 2) chzzk 채널 중, live_state_updated_at 이 오래된 것만 골라오기(스케줄 최적화)
  const { data: channels, error } = await supabaseService
    .from('channels')
    .select(
      'id, platform, platform_channel_id, is_live_now, live_state_updated_at, last_live_started_at, last_live_ended_at'
    )
    .eq('platform', 'chzzk')
    .order('live_state_updated_at', { ascending: true, nullsFirst: true });

  if (error) return NextResponse.json({ error: 'DB', details: error.message }, { status: 500 });

  const cutoff = Date.now() - staleMin * 60_000;
  let targets = (channels ?? []).filter((c) => {
    const last = c.live_state_updated_at ? new Date(c.live_state_updated_at).getTime() : 0;
    return last < cutoff; // 오래된 것만
  });

  if (limit && Number.isFinite(limit)) {
    targets = targets.slice(0, limit);
  }

  // 2-1) dry-run: 이번에 돌 대상만 미리 보여주기
  if (dryRun) {
    const finishedAt = new Date();
    return NextResponse.json({
      ok: true,
      mode: 'live-poll',
      dryRun: true,
      parameters: { staleMin, concurrency, batchDelayMs, limit, verbose, dryRun },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      queuedChannelIds: targets.map((t) => t.id),
    });
  }

  if (!targets.length) {
    const finishedAt = new Date();
    return NextResponse.json({
      ok: true,
      mode: 'live-poll',
      attempted: 0,
      updated: 0,
      failed: 0,
      cooldown: 0,
      failReasons: {},
      parameters: { staleMin, concurrency, batchDelayMs, limit, verbose, dryRun },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });
  }

  let attempted = 0;
  let updated = 0;
  const failReasons: Record<string, number> = {};
  const sampleErrors: Array<{ channelId: string; details: string }> = [];
  const channelResults: Array<{
    channelId: string;
    wasLive?: boolean;
    isLiveNow?: boolean;
    result: 'ok' | 'fail';
    sessionAction?: string;
    sessionId?: string | null;
    liveDetail?: {
      liveId: number;
      title: string;
      viewerCount: number | null;
      category: string | null;
      thumbnail: string | null;
    };
  }> = [];

  async function pollOne(ch: ChzzkChannelRow) {
    attempted++;
    try {
      const live = await getChzzkLiveStatus(ch.platform_channel_id);
      if (!live) {
        const key = 'live-detail:fetch-failed';
        failReasons[key] = (failReasons[key] ?? 0) + 1;
        if (sampleErrors.length < 5) sampleErrors.push({ channelId: ch.id, details: key });
        if (verbose) channelResults.push({ channelId: ch.id, wasLive: !!ch.is_live_now, result: 'fail' });
        return;
      }

      const isLiveNow = !!live.openLive;
      const d = live.liveDetail;

      // 통합 세션/상태 반영 RPC - 개선된 파라미터 전달
      const { data: rpcResult, error: liveRpcErr } = await supabaseService.rpc('rpc_channels_manage_live_session', {
        p_channel_id: ch.id,
        p_is_live_now: isLiveNow,
        p_now: new Date().toISOString(),
        p_live_id: d?.liveId ?? null,
        p_live_title: d?.liveTitle ?? null,
        p_live_thumbnail: d?.liveImageUrl ?? null,
        p_viewer_count: d?.concurrentUserCount ?? null,
        p_category: d?.categoryType ?? null,
        p_live_start_time: d?.openDate ?? null, // "yyyy-MM-dd HH:mm:ss" (KST)
        p_chat_channel_id: d?.chatChannelId ?? null,
        p_adult: d?.adult ?? null,
        p_live_close_time: d?.closeDate ?? null,
      });

      if (liveRpcErr) {
        const key = liveRpcErr.message ?? 'rpc_channels_manage_live_session';
        failReasons[key] = (failReasons[key] ?? 0) + 1;
        if (sampleErrors.length < 5) sampleErrors.push({ channelId: ch.id, details: key });
        if (verbose) {
          channelResults.push({
            channelId: ch.id,
            wasLive: !!ch.is_live_now,
            isLiveNow,
            result: 'fail',
            sessionAction: 'rpc_error',
          });
        }
        return;
      }

      updated++;
      if (verbose) {
        channelResults.push({
          channelId: ch.id,
          wasLive: rpcResult?.was_live || false,
          isLiveNow,
          result: 'ok',
          sessionAction: rpcResult?.session_action || 'none',
          sessionId: rpcResult?.session_id || null,
          liveDetail: d
            ? {
                liveId: d.liveId,
                title: d.liveTitle,
                viewerCount: d.concurrentUserCount,
                category: d.categoryType,
                thumbnail: d.liveImageUrl,
              }
            : undefined,
        });
      }
    } catch (e: any) {
      const key = String(e?.message ?? e);
      failReasons[key] = (failReasons[key] ?? 0) + 1;
      if (sampleErrors.length < 5) sampleErrors.push({ channelId: ch.id, details: key });
      if (verbose) channelResults.push({ channelId: ch.id, wasLive: !!ch.is_live_now, result: 'fail' });
    }
  }

  // 3) 동시성 제한 처리
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(pollOne));
    if (i + concurrency < targets.length && batchDelayMs > 0) {
      await new Promise((r) => setTimeout(r, batchDelayMs));
    }
  }

  const finishedAt = new Date();
  const failed = Math.max(0, attempted - updated);
  const res: any = {
    ok: true,
    mode: 'live-poll',
    attempted,
    updated,
    failed,
    cooldown: 0,
    failReasons,
    parameters: { staleMin, concurrency, batchDelayMs, limit, verbose, dryRun },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };

  if (sampleErrors.length) res.sampleErrors = sampleErrors;
  if (verbose) res.channels = channelResults;

  return NextResponse.json(res);
}
