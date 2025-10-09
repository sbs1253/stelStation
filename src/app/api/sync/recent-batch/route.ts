
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';
import { createSyncDeps } from '@/services/sync/syncDeps';
import { runChannelSync } from '@/services/sync/runChannelSync';

const CRON_SECRET: string = (() => {
  const value = process.env.CRON_SECRET;
  if (!value) throw new Error('CRON_SECRET is not configured');
  return value;
})();

// 기본 동시성/배치 간격(쿼리로 오버라이드 가능)
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_BATCH_DELAY_MS = 250;

const BodySchema = z.object({
  creatorId: z.string().uuid().optional(),
  channelIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(['recent']).default('recent'),
  force: z.boolean().optional(),
});
  const deps = createSyncDeps();

// 라우트 핸들러
export async function POST(req: Request) {
  const SYNC_ENABLED = process.env.SYNC_ENABLED !== 'false';
  if (!SYNC_ENABLED) return NextResponse.json({ ok: true, skipped: 'sync disabled' }, { status: 204 });

  // 0) 내부 보호
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
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

  // 2) 바디 검증 (빈 바디 허용)
  //    - POST 본문이 비어 있으면 `{}` 로 간주하여 기본 동작(전체 채널 recent)을 수행합니다.
  //    - 잘못된 JSON일 때만 400을 반환합니다.
  let body: z.infer<typeof BodySchema>;
  {
    let parsedJson: unknown = {};
    try {
      const rawText = await req.text(); // 빈 본문이어도 예외가 나지 않음
      parsedJson = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid body', details: 'Malformed JSON' }, { status: 400 });
    }
    const result = BodySchema.safeParse(parsedJson);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid body', details: result.error.flatten() }, { status: 400 });
    }
    body = result.data;
  }
  // 입력이 없으면 기본값으로 동작(creatorId/channelIds 미필요)

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

  // 3-bis) 대상 집합 정제: 플랫폼 필터 + (옵션) 쿨타임 사전 필터
  //   - channelIds/creatorId가 있으면 그 집합을 정제
  //   - 아무 입력이 없으면 "전체 채널"을 기준으로 집합 구성
  const now = new Date();

  async function refineByPlatformAndCooldown(seedIds: string[] | null): Promise<string[]> {
    if (seedIds && seedIds.length > 0) {
      const q = await supabaseService.from('channels').select('id, platform, sync_cooldown_until').in('id', seedIds);
      if (q.error) {
        throw new Error(`DB error(refine seed): ${q.error.message}`);
      }
      let rows = q.data ?? [];
      if (platformFilter) rows = rows.filter((r) => r.platform === platformFilter);
      if (!body.force) {
        rows = rows.filter((r) => !r.sync_cooldown_until || new Date(r.sync_cooldown_until) <= now);
      }
      return rows.map((r) => r.id);
    } else {
      // 전체 채널에서 선택
      let q = supabaseService.from('channels').select('id, platform, sync_cooldown_until');
      if (platformFilter) {
        q = q.eq('platform', platformFilter);
      }
      const r = await q;
      if (r.error) {
        throw new Error(`DB error(select all): ${r.error.message}`);
      }
      let rows = r.data ?? [];
      if (!body.force) {
        rows = rows.filter((x) => !x.sync_cooldown_until || new Date(x.sync_cooldown_until) <= now);
      }
      return rows.map((x) => x.id);
    }
  }

  try {
    targetChannelIds = await refineByPlatformAndCooldown(targetChannelIds.length ? targetChannelIds : null);
  } catch (e: any) {
    return NextResponse.json({ error: 'DB error', details: String(e?.message ?? e) }, { status: 500 });
  }

  // 모든 필터링을 마친 뒤 limit 적용
  if (limit !== null && targetChannelIds.length > limit) {
    targetChannelIds = targetChannelIds.slice(0, limit);
  }

  // 입력/쿨타임/플랫폼/리미트 적용 후에도 비어 있으면 즉시 종료
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

async function syncOne(
  channelId: string,
  mode: 'recent',
  force: boolean
): Promise<{ channelId: string; state: 'ok' | 'cooldown' | 'fail'; reason?: string }> {
  try {
    const res = await runChannelSync(deps, { channelId, mode, force });
    if (!res.ok) {
      // runChannelSync는 쿨다운이면 status 429로 실패 반환
      if (res.status === 429) {
        const reason = typeof res.body?.error === 'string' ? res.body.error : 'COOLDOWN';
        return { channelId, state: 'cooldown', reason };
      }
      const reason =
        (typeof res.body?.error === 'string' && res.body.error) ||
        (typeof res.body?.message === 'string' && res.body.message) ||
        `status:${res.status}`;
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
    const batchResults = await Promise.allSettled(batch.map((id) => syncOne(id, 'recent', !!body.force)));

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
    attempted,
    succeeded,
    cooldown,
    failed,
    ...(failed ? { failReasons } : {}),
    ...(failed ? { sampleErrors } : {}),
    ...(verbose ? { channels: results } : {}),
  });
}
