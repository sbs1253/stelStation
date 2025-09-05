// app/api/stats/snapshot/route.ts

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service'; // service role 클라이언트

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseService;

  const snap = await supabase.rpc('rpc_stats_snapshot_today');
  if (snap.error) {
    return NextResponse.json({ error: 'snapshot error', details: snap.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    snapshot: snap.data,
  });
}
