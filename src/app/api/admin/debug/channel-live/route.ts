// app/api/admin/debug/channel-live/route.ts
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';

export async function GET(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const u = new URL(req.url);
  const id = u.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data, error } = await supabaseService
    .from('channels')
    .select('id, title, platform, is_live_now, live_state_updated_at, last_live_started_at, last_live_ended_at')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: 'DB', details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, channel: data });
}
