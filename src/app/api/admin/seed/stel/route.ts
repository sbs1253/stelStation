import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { STEL_SEEDS } from '@/lib/config/seeds';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 300;

export async function POST(req: Request) {
  // ── 보안: 내부 호출만 허용 ─────────────────────────────────────────────────────
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();

  const url = new URL(req.url);
  const withRecentSync = (url.searchParams.get('sync') ?? '').toLowerCase() === 'recent';
  const verbose = ['1', 'true', 'yes'].includes((url.searchParams.get('verbose') ?? '').toLowerCase());
  const origin = url.origin;

  const createdIds: string[] = [];
  const existingIds: string[] = [];
  const allChannelUUIDs: string[] = [];

  // 1) 시드 upsert (YouTube / Chzzk)
  for (const seed of STEL_SEEDS) {
    // YouTube
    if (seed.youtube?.ucId) {
      const youtubeUpsert = await upsertChannel('youtube', seed.youtube.ucId, seed.name, null);
      (youtubeUpsert.created ? createdIds : existingIds).push(youtubeUpsert.id);
      allChannelUUIDs.push(youtubeUpsert.id);
    }
    // Chzzk
    if (seed.chzzk?.channelId) {
      const chzzkUpsert = await upsertChannel('chzzk', seed.chzzk.channelId, seed.name, null);
      (chzzkUpsert.created ? createdIds : existingIds).push(chzzkUpsert.id);
      allChannelUUIDs.push(chzzkUpsert.id);
    }
  }

  // 2) 옵션: 즉시 recent 동기화(쿨다운 무시) ─ 채널당 /api/sync/channel 호출
  let syncStats: {
    attempted: number;
    succeeded: number;
    failed: number;
    failReasons: Record<string, number>;
    channels?: Array<{ channelId: string; result: 'ok' | 'fail'; reason?: string }>;
    sampleErrors?: Array<{ channelId: string; reason: string }>;
  } | null = null;

  if (withRecentSync && allChannelUUIDs.length) {
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    const failReasons: Record<string, number> = {};
    const channelResults: Array<{ channelId: string; result: 'ok' | 'fail'; reason?: string }> = [];
    const sampleErrors: Array<{ channelId: string; reason: string }> = [];

    for (let i = 0; i < allChannelUUIDs.length; i += CONCURRENCY) {
      const batch = allChannelUUIDs.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (id) => {
          try {
            const res = await fetch(`${origin}/api/sync/channel`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-cron-secret': ADMIN_SECRET,
              },
              // ★ 쿨다운 무시하고 즉시 동기화
              body: JSON.stringify({ channelId: id, mode: 'recent', force: true }),
            });

            attempted++;

            // 응답 바디 파싱(가능하면)
            let payload: any = null;
            try {
              payload = await res.json();
            } catch {
              payload = null;
            }

            if (res.ok && !payload?.error) {
              succeeded++;
              if (verbose) channelResults.push({ channelId: id, result: 'ok' });
            } else {
              failed++;
              const reason =
                (payload?.error as string) ||
                (payload?.details as string) ||
                (payload?.message as string) ||
                `HTTP ${res.status}`;
              failReasons[reason] = (failReasons[reason] ?? 0) + 1;
              if (sampleErrors.length < 5) sampleErrors.push({ channelId: id, reason });
              if (verbose) channelResults.push({ channelId: id, result: 'fail', reason });
            }
          } catch (e: any) {
            attempted++;
            failed++;
            const reason = `fetch failed${e?.message ? `: ${e.message}` : ''}`;
            failReasons[reason] = (failReasons[reason] ?? 0) + 1;
            if (sampleErrors.length < 5) sampleErrors.push({ channelId: id, reason });
            if (verbose) channelResults.push({ channelId: id, result: 'fail', reason });
          }
        })
      );

      // 배치 간 짧은 대기(폭주 방지)
      if (i + CONCURRENCY < allChannelUUIDs.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }

      // 결과 배열 자체는 사용하지 않지만 Promise.allSettled가 끝까지 기다리도록 유지
      void results;
    }

    syncStats = {
      attempted,
      succeeded,
      failed,
      failReasons,
      ...(verbose ? { channels: channelResults } : {}),
      ...(sampleErrors.length ? { sampleErrors } : {}),
    };
  }

  const finishedAt = new Date();

  return NextResponse.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    parameters: {
      concurrency: CONCURRENCY,
      batchDelayMs: BATCH_DELAY_MS,
      sync: withRecentSync,
      verbose,
    },
    created: createdIds.length,
    existing: existingIds.length,
    totalChannels: allChannelUUIDs.length,
    ...(verbose ? { seeds: { createdIds, existingIds } } : {}),
    ...(syncStats ? { sync: syncStats } : {}),
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// 내부 유틸: 채널 upsert (플랫폼/channel_id로 고유)
// ───────────────────────────────────────────────────────────────────────────────
async function upsertChannel(
  platform: 'youtube' | 'chzzk',
  platformChannelId: string,
  title: string | null,
  thumbnailUrl: string | null
): Promise<{ id: string; created: boolean }> {
  // 존재 확인
  const sel = await supabaseService
    .from('channels')
    .select('id')
    .eq('platform', platform)
    .eq('platform_channel_id', platformChannelId)
    .maybeSingle();

  if (sel.error) throw sel.error;
  if (sel.data?.id) return { id: sel.data.id, created: false };

  // 신규 insert
  const ins = await supabaseService
    .from('channels')
    .insert({
      platform,
      platform_channel_id: platformChannelId,
      title,
      thumbnail_url: thumbnailUrl,
    })
    .select('id')
    .single();

  if (ins.error) throw ins.error;
  return { id: ins.data!.id, created: true };
}
