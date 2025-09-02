export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { HYDRATION_TTL_HOURS } from '@/lib/config/constants';
const CRON_SECRET = process.env.CRON_SECRET!;

export async function POST(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1) videos_cache: KST 기준 120일 이전 (+옵션 TTL)
  const { data: vres, error: verr } = await supabaseService.rpc(
    'rpc_purge_videos_older_than_120d',
    { p_ttl_hours: HYDRATION_TTL_HOURS ?? null } // TTL 쓰기 싫으면 null
  );
  if (verr) return NextResponse.json({ error: 'DB', where: 'videos_cache', details: verr.message }, { status: 500 });

  // 2) video_stats_daily: KST 기준 30일 이전
  const { data: sres, error: serr } = await supabaseService.rpc('rpc_stats_purge_older_than_30d');
  if (serr)
    return NextResponse.json({ error: 'DB', where: 'video_stats_daily', details: serr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    cutoffs: { videos: vres?.cutoff ?? null, daily: sres?.cutoff ?? null },
    deleted: { videos: vres?.deleted_count ?? 0, daily: sres?.deleted_count ?? 0 },
  });
}
