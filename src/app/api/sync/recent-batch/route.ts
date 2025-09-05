// src/app/api/sync/recent-batch/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_BATCH_DELAY_MS = 250;

const BodySchema = z.object({
  creatorId: z.string().uuid().optional(),
  channelIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(['recent']).default('recent'),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  // 0) 보호
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1) 바디 검증
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  if (!body.creatorId && (!body.channelIds || body.channelIds.length === 0)) {
    return NextResponse.json({ error: 'Either creatorId or channelIds[] is required.' }, { status: 400 });
  }

  // 2) 대상 채널 목록
  let targetChannelIds: string[] = [];

  if (body.creatorId) {
    const q = await supabaseService.from('creator_channels').select('channel_id').eq('creator_id', body.creatorId);

    if (q.error) {
      return NextResponse.json({ error: 'DB error', details: q.error.message }, { status: 500 });
    }
    targetChannelIds = (q.data ?? []).map((r) => r.channel_id);
  }

  if (body.channelIds?.length) {
    const set = new Set([...(targetChannelIds ?? []), ...body.channelIds]);
    targetChannelIds = Array.from(set);
  }

  if (!targetChannelIds.length) {
    return NextResponse.json({ ok: true, attempted: 0, succeeded: 0, failed: 0, results: [] });
  }

  // 3) 헬퍼
  const origin = new URL(req.url).origin;
  async function syncOne(channelId: string): Promise<{ channelId: string; ok: boolean; reason?: string }> {
    try {
      const res = await fetch(`${origin}/api/sync/channel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-secret': ADMIN_SECRET,
        },
        body: JSON.stringify({
          channelId,
          mode: 'recent',
          ...(body.force ? { force: true } : {}),
        }),
      });

      if (!res.ok) {
        let reason = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) reason = `${j.error}${j.details ? `: ${j.details}` : ''}`;
        } catch {}
        return { channelId, ok: false, reason };
      }
      return { channelId, ok: true };
    } catch (e: any) {
      return { channelId, ok: false, reason: String(e?.message ?? e) };
    }
  }

  // 4) 제한 동시성 실행
  const concurrency = DEFAULT_CONCURRENCY;
  const batchDelayMs = DEFAULT_BATCH_DELAY_MS;

  const results: Array<{ channelId: string; ok: boolean; reason?: string }> = [];
  for (let i = 0; i < targetChannelIds.length; i += concurrency) {
    const batch = targetChannelIds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((id) => syncOne(id)));
    for (const s of settled) {
      if (s.status === 'fulfilled') results.push(s.value);
      else results.push({ channelId: 'unknown', ok: false, reason: 'Promise rejected' });
    }
    if (i + concurrency < targetChannelIds.length) {
      await new Promise((r) => setTimeout(r, batchDelayMs));
    }
  }

  // 5) 요약
  const attempted = results.length;
  const succeeded = results.filter((r) => r.ok).length;
  const failed = attempted - succeeded;

  const failReasons: Record<string, number> = {};
  for (const r of results) {
    if (!r.ok) {
      const key = r.reason ?? 'unknown';
      failReasons[key] = (failReasons[key] ?? 0) + 1;
    }
  }

  return NextResponse.json({ ok: true, attempted, succeeded, failed, results, ...(failed ? { failReasons } : {}) });
}
