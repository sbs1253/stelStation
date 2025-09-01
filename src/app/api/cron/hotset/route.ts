export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

const CRON_SECRET = process.env.CRON_SECRET!;
const CONCURRENCY = 5;

export async function POST(request: Request) {
  if (request.headers.get('x-cron-secret') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  const { data: chzzkChannels, error } = await supabaseService
    .from('channels')
    .select('id, platform_channel_id')
    .eq('platform', 'chzzk');

  if (error) return NextResponse.json({ error: 'DB', details: error.message }, { status: 500 });
  const pick = (chzzkChannels ?? []).map((c: any) => c.platform_channel_id || c.id);
  if (!pick.length) return NextResponse.json({ ok: true, processed: 0 });

  let processed = 0;
  for (let i = 0; i < pick.length; i += CONCURRENCY) {
    const batch = pick.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((channelId: string) =>
        fetch(`${origin}/api/sync/channel`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ channelId, mode: 'recent' }),
        })
      )
    );
    processed += results.length;
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ ok: true, processed });
}
