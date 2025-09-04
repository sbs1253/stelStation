import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { STEL_SEEDS } from '@/lib/config/seeds';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const CONCURRENCY = 3;
const PAUSE_MS = 300;

type ChannelMeta = { platform: 'youtube' | 'chzzk'; platformChannelId: string; name: string };
const byUuid: Record<string, ChannelMeta> = {};
const failures: Array<ChannelMeta & { id: string; status?: number; error?: string; details?: any }> = [];

export async function POST(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const doSync = (url.searchParams.get('sync') ?? '').toLowerCase() === 'recent';
  const origin = url.origin;

  const created: string[] = [];
  const existing: string[] = [];
  const allChannelUUIDs: string[] = [];

  // 1) 시드 upsert
  for (const seed of STEL_SEEDS) {
    // YouTube
    if (seed.youtube?.ucId) {
      const r1 = await upsertChannel('youtube', seed.youtube.ucId, seed.name, null);
      (r1.created ? created : existing).push(r1.id);
      allChannelUUIDs.push(r1.id);
    }
    // Chzzk (있으면)
    if (seed.chzzk?.channelId) {
      const r2 = await upsertChannel('chzzk', seed.chzzk.channelId, seed.name, null);
      (r2.created ? created : existing).push(r2.id);
      allChannelUUIDs.push(r2.id);
    }
  }

  // 2) 즉시 recent 동기화 (옵션)
  let syncStats: { attempted: number; succeeded: number; failed: number } | null = null;
  if (doSync && allChannelUUIDs.length) {
    let attempted = 0,
      succeeded = 0,
      failed = 0;

    for (let i = 0; i < allChannelUUIDs.length; i += CONCURRENCY) {
      const batch = allChannelUUIDs.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch(`${origin}/api/sync/channel`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-cron-secret': ADMIN_SECRET,
            },
            // ★ 쿨다운 무시하고 즉시 동기화
            body: JSON.stringify({ channelId: id, mode: 'recent', force: true }),
          })
        )
      );

      for (const r of results) {
        attempted++;
        if (r.status === 'fulfilled') {
          try {
            const j = await r.value.json().catch(() => ({}));
            if (r.value.status < 400 && !j?.error) succeeded++;
            else failed++;
          } catch {
            failed++;
          }
        } else {
          failed++;
        }
      }

      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }

    syncStats = { attempted, succeeded, failed };
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    existing: existing.length,
    totalChannels: allChannelUUIDs.length,
    ...(syncStats ? { sync: syncStats } : {}),
  });
}

// 그대로 사용 (변경 없음)
async function upsertChannel(
  platform: 'youtube' | 'chzzk',
  platformChannelId: string,
  title: string | null,
  thumb: string | null
): Promise<{ id: string; created: boolean }> {
  const sel = await supabaseService
    .from('channels')
    .select('id')
    .eq('platform', platform)
    .eq('platform_channel_id', platformChannelId)
    .maybeSingle();

  if (sel.error) throw sel.error;
  if (sel.data?.id) return { id: sel.data.id, created: false };

  const ins = await supabaseService
    .from('channels')
    .insert({
      platform,
      platform_channel_id: platformChannelId,
      title,
      thumbnail_url: thumb,
    })
    .select('id')
    .single();

  if (ins.error) throw ins.error;
  return { id: ins.data!.id, created: true };
}
