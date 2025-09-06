// src/app/api/sync/recent-batch/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

// 기본 동시성/배치 간격(쿼리로 오버라이드 가능)
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_BATCH_DELAY_MS = 250;

const BodySchema = z.object({
  creatorId: z.string().uuid().optional(),
  channelIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(['recent']).default('recent'),
  force: z.boolean().optional(),
});

// 라우트 핸들러
export async function POST(req: Request) {
  // 0) 내부 보호
  if ((req.headers.get('x-cron-secret') ?? '') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();

  // 1) 쿼리 파라미터(테스트/운영 튜닝용)
  //    - concurrency: 동시에 처리할 채널 개수 (기본 2)
  //    - batchDelayMs: 배치 사이 대기(ms) (기본 250)
  //    - limit: 처리할 채널 수 상한 (미지정 시 전체)
  //    - dryRun=1: 실제 호출 없이 큐잉될 채널 목록만 반환
  //    - verbose=1: 채널별 결과 배열 포함
  const url = new URL(req.url);
  const queryConcurrencyRaw = url.searchParams.get('concurrency');
  const queryBatchDelayMsRaw = url.searchParams.get('batchDelayMs');
  const queryLimitRaw = url.searchParams.get('limit');
  const dryRun = url.searchParams.get('dryRun') === '1';
  const verbose = url.searchParams.get('verbose') === '1';

  const concurrency = (() => {
    const n = Number(queryConcurrencyRaw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    return DEFAULT_CONCURRENCY;
  })();

  const batchDelayMs = (() => {
    const n = Number(queryBatchDelayMsRaw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    return DEFAULT_BATCH_DELAY_MS;
  })();

  const limit = (() => {
    if (queryLimitRaw == null) return null;
    const n = Number(queryLimitRaw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  })();

  const queryPlatformRaw = url.searchParams.get('platform');
  const platformFilter = queryPlatformRaw === 'youtube' || queryPlatformRaw === 'chzzk' ? queryPlatformRaw : null;

  // 2) 바디 검증
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }
  if (!body.creatorId && (!body.channelIds || body.channelIds.length === 0)) {
    return NextResponse.json({ error: 'Either creatorId or channelIds[] is required.' }, { status: 400 });
  }

  // 3) 대상 채널 수집(creatorId 매핑 + 직접 전달된 channelIds 병합)
  let targetChannelIds: string[] = [];

  if (body.creatorId) {
    const mappingQuery = await supabaseService
      .from('creator_channels')
      .select('channel_id')
      .eq('creator_id', body.creatorId);
    if (mappingQuery.error) {
      return NextResponse.json({ error: 'DB error', details: mappingQuery.error.message }, { status: 500 });
    }
    targetChannelIds = (mappingQuery.data ?? []).map((r) => r.channel_id);
  }

  if (body.channelIds?.length) {
    const set = new Set([...(targetChannelIds ?? []), ...body.channelIds]);
    targetChannelIds = Array.from(set);
  }

  // Optional platform filter (youtube | chzzk)
  if (platformFilter && targetChannelIds.length) {
    const platformFilterQuery = await supabaseService
      .from('channels')
      .select('id')
      .in('id', targetChannelIds)
      .eq('platform', platformFilter);
    if (platformFilterQuery.error) {
      return NextResponse.json({ error: 'DB error', details: platformFilterQuery.error.message }, { status: 500 });
    }
    targetChannelIds = (platformFilterQuery.data ?? []).map((r) => r.id);
  }

  // 모든 필터링을 마친 뒤 limit 적용
  if (limit !== null) {
    targetChannelIds = targetChannelIds.slice(0, limit);
  }

  if (!targetChannelIds.length) {
    const finishedAt = new Date();
    return NextResponse.json({
      ok: true,
      mode: 'recent-batch',
      parameters: { concurrency, batchDelayMs, limit, dryRun, verbose, platform: platformFilter },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      processed: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      ...(verbose ? { channels: [] } : {}),
    });
  }

  // 4) dry-run: 실제 호출 없이, 이번에 처리될 채널 목록만 반환
  if (dryRun) {
    const finishedAt = new Date();
    return NextResponse.json({
      ok: true,
      mode: 'recent-batch',
      dryRun: true,
      parameters: { concurrency, batchDelayMs, limit, dryRun, verbose, platform: platformFilter },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      queuedChannelIds: targetChannelIds,
    });
  }

  // 5) 개별 채널 recent 실행 헬퍼
  const origin = new URL(req.url).origin;
  async function syncOne(
    channelId: string
  ): Promise<{ channelId: string; state: 'ok' | 'cooldown' | 'fail'; reason?: string }> {
    try {
      const res = await fetch(`${origin}/api/sync/channel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({
          channelId,
          mode: 'recent',
          ...(body.force ? { force: true } : {}),
        }),
      });

      // Treat 429 separately as cooldown
      if (res.status === 429) {
        let reason = 'HTTP 429';
        try {
          const j = await res.json();
          if (j?.error) reason = `${j.error}${j.details ? `: ${j.details}` : ''}`;
        } catch {}
        return { channelId, state: 'cooldown', reason };
      }

      if (!res.ok) {
        let reason = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) reason = `${j.error}${j.details ? `: ${j.details}` : ''}`;
        } catch {}
        return { channelId, state: 'fail', reason };
      }

      return { channelId, state: 'ok' };
    } catch (e: any) {
      return { channelId, state: 'fail', reason: String(e?.message ?? e) };
    }
  }

  // 6) 제한 동시성 실행(배치 간 대기)
  const results: Array<{ channelId: string; state: 'ok' | 'cooldown' | 'fail'; reason?: string }> = [];
  for (let i = 0; i < targetChannelIds.length; i += concurrency) {
    const batch = targetChannelIds.slice(i, i + concurrency);

    // 각 요청과 channelId의 인덱스 매핑을 유지해, 실패 시에도 정확한 channelId를 기록
    const batchResults = await Promise.allSettled(batch.map((id) => syncOne(id)));

    for (let idx = 0; idx < batchResults.length; idx++) {
      const s = batchResults[idx];
      const id = batch[idx];
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        // Promise 자체가 reject된 경우도 해당 채널 id를 포함해 기록
        results.push({
          channelId: id,
          state: 'fail',
          reason: s.reason ? String(s.reason) : 'Promise rejected',
        });
      }
    }

    if (i + concurrency < targetChannelIds.length && batchDelayMs > 0) {
      await new Promise((r) => setTimeout(r, batchDelayMs));
    }
  }

  // 7) 요약/집계
  const attempted = results.length;
  const succeeded = results.filter((r) => r.state === 'ok').length;
  const cooldown = results.filter((r) => r.state === 'cooldown').length;
  const failed = results.filter((r) => r.state === 'fail').length;

  const failReasons: Record<string, number> = {};
  const sampleErrors: Array<{ channelId: string; reason: string }> = [];
  for (const r of results) {
    if (r.state === 'fail') {
      const key = r.reason ?? 'unknown';
      failReasons[key] = (failReasons[key] ?? 0) + 1;
      if (sampleErrors.length < 5) sampleErrors.push({ channelId: r.channelId, reason: key });
    }
  }

  const finishedAt = new Date();

  // 8) 응답
  return NextResponse.json({
    ok: true,
    mode: 'recent-batch',
    parameters: { concurrency, batchDelayMs, limit, dryRun, verbose, platform: platformFilter },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    processed: attempted, // 과거 호환용 이름
    attempted,
    succeeded,
    cooldown,
    failed,
    ...(failed ? { failReasons } : {}),
    ...(failed ? { sampleErrors } : {}),
    ...(verbose ? { channels: results } : {}),
  });
}
