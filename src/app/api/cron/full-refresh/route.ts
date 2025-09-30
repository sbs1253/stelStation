import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

// 기본값
const DEFAULT_CONCURRENCY = 3; // 동시에 처리할 채널 개수
const DEFAULT_BATCH_DELAY_MS = 400; // 배치 간 대기(ms)

const CRON_SECRET: string = (() => {
  const value = process.env.CRON_SECRET;
  if (!value) throw new Error('CRON_SECRET is not configured');
  return value;
})();

// 배치 사이 지연용
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  /** 0) 내부 인증 확인 */
  const receivedSecret = request.headers.get('x-cron-secret');
  if (receivedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const origin = new URL(request.url).origin;
  const url = new URL(request.url);

  /** 1) 런타임 파라미터 */
  const overrideConcurrency = parseInt(url.searchParams.get('concurrency') || '') || DEFAULT_CONCURRENCY;
  const overrideBatchDelayMs = parseInt(url.searchParams.get('batchDelayMs') || '') || DEFAULT_BATCH_DELAY_MS;
  const limitCount = parseInt(url.searchParams.get('limit') || '') || undefined;
  const platformFilter = (url.searchParams.get('platform') || '').toLowerCase(); // 'youtube' | 'chzzk' | ''
  const dryRun = (url.searchParams.get('dryRun') || '').toLowerCase() === '1';
  const verbose = (url.searchParams.get('verbose') || '').toLowerCase() === '1';

  /** 2) 대상 채널 조회 (last_synced_at 오래된 순) */
  let query = supabaseService
    .from('channels')
    .select('id, platform')
    .order('last_synced_at', { ascending: true, nullsFirst: true });

  // 플랫폼 제한(선택)
  if (platformFilter === 'youtube' || platformFilter === 'chzzk') {
    query = query.eq('platform', platformFilter);
  }
  // 처리 개수 제한(선택)
  if (typeof limitCount === 'number') {
    query = query.limit(limitCount);
  }

  const { data: channels, error: selectError } = await query;

  if (selectError) {
    return NextResponse.json({ error: 'DB', details: selectError.message }, { status: 500 });
  }
  if (!channels?.length) {
    const finishedAt = new Date();
    return NextResponse.json({
      ok: true,
      mode: 'full',
      parameters: {
        concurrency: overrideConcurrency,
        batchDelayMs: overrideBatchDelayMs,
        limit: limitCount ?? null,
        platform: platformFilter || null,
        dryRun,
        verbose,
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      processed: 0,
      attempted: 0,
      succeeded: 0,
      cooldown: 0,
      failed: 0,
      failReasons: {},
      ...(verbose ? { channels: [] as any[] } : {}),
    });
  }

  /** 3) 드라이런: 어떤 채널이 큐에 올라갈지 미리 보기 */
  if (dryRun) {
    const finishedAt = new Date();
    return NextResponse.json({
      ok: true,
      mode: 'full',
      dryRun: true,
      parameters: {
        concurrency: overrideConcurrency,
        batchDelayMs: overrideBatchDelayMs,
        limit: limitCount ?? null,
        platform: platformFilter || null,
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      queuedChannelIds: channels.map((c) => c.id),
    });
  }

  /** 4) 실패 사유 집계 및 대표 에러 샘플 수집(최대 5건) */
  const failReasons: Record<string, number> = {};
  const sampleErrors: Array<{ channelId: string; status?: number; details?: string }> = [];
  const perChannelResults: Array<{ channelId: string; result: 'ok' | 'cooldown' | 'fail' }> = [];

  // 5) 단일 채널 동기화 헬퍼

  async function syncOneChannel(channelId: string): Promise<'ok' | 'cooldown' | 'fail'> {
    try {
      const response = await fetch(`${origin}/api/sync/channel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ channelId, mode: 'full' }),
      });

      if (response.status === 429) {
        return 'cooldown';
      }
      if (!response.ok) {
        try {
          const text = await response.text();
          let reason = String(response.status);
          try {
            const json = JSON.parse(text);
            reason = json?.details || json?.error || reason;
          } catch {}
          failReasons[reason] = (failReasons[reason] || 0) + 1;
          if (sampleErrors.length < 5) {
            sampleErrors.push({ channelId, status: response.status, details: reason });
          }
        } catch {
          const reason = String(response.status);
          failReasons[reason] = (failReasons[reason] || 0) + 1;
          if (sampleErrors.length < 5) {
            sampleErrors.push({ channelId, status: response.status, details: reason });
          }
        }
        return 'fail';
      }
      return 'ok';
    } catch (error: any) {
      const reason = error?.message ? String(error.message) : 'fetch_failed';
      failReasons[reason] = (failReasons[reason] || 0) + 1;
      if (sampleErrors.length < 5) {
        sampleErrors.push({ channelId, details: reason });
      }
      return 'fail';
    }
  }

  /** 6) 동시성 제한 루프(배치 처리 + 배치 간 대기) */
  let attempted = 0;
  let succeeded = 0;
  let cooldown = 0;
  let failed = 0;

  for (let i = 0; i < channels.length; i += overrideConcurrency) {
    const batch = channels.slice(i, i + overrideConcurrency);

    const results = await Promise.allSettled(batch.map((c) => syncOneChannel(c.id)));

    for (let b = 0; b < results.length; b++) {
      attempted++;
      const result = results[b];
      const resultValue = result.status === 'fulfilled' ? result.value : 'fail';
      if (resultValue === 'ok') succeeded++;
      else if (resultValue === 'cooldown') cooldown++;
      else failed++;

      if (verbose) {
        perChannelResults.push({ channelId: batch[b].id, result: resultValue });
      }
    }

    // 아직 처리할 채널이 남아 있으면 배치 간 대기
    if (i + overrideConcurrency < channels.length) {
      await delay(overrideBatchDelayMs);
    }
  }

  /** 7) 결과 응답 */
  const finishedAt = new Date();

  return NextResponse.json({
    ok: true,
    mode: 'full',
    parameters: {
      concurrency: overrideConcurrency,
      batchDelayMs: overrideBatchDelayMs,
      limit: limitCount ?? null,
      platform: platformFilter || null,
      dryRun,
      verbose,
    },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    attempted,
    succeeded,
    cooldown,
    failed,
    failReasons,
    ...(sampleErrors.length ? { sampleErrors } : {}),
    ...(verbose ? { channels: perChannelResults } : {}),
  });
}
