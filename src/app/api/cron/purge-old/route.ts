import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import { HYDRATION_TTL_HOURS } from '@/lib/config/constants';

const CRON_SECRET = process.env.CRON_SECRET!;

export async function POST(req: Request) {
  // 실행 메타: 시작 시각 기록
  const startedAt = new Date();

  // 0) 내부 보호
  if ((req.headers.get('x-cron-secret') ?? '') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // videos_cache: KST 기준 120일 이전(+옵션 TTL) 정리
  const { data: purgeVideosResult, error: purgeVideosError } = await supabaseService.rpc(
    'rpc_purge_videos_older_than_120d',
    {
      p_ttl_hours: HYDRATION_TTL_HOURS ?? null, // TTL 쓰기 싫으면 null
    }
  );

  if (purgeVideosError) {
    const finishedAt = new Date();
    return NextResponse.json(
      {
        ok: false,
        error: 'DB',
        where: 'videos_cache',
        details: purgeVideosError.message,
        parameters: { ttlHours: HYDRATION_TTL_HOURS ?? null },
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
      { status: 500 }
    );
  }

  // video_stats_daily: KST 기준 30일 이전 스냅샷 정리
  const { data: purgeDailyStatsResult, error: purgeDailyStatsError } = await supabaseService.rpc(
    'rpc_stats_purge_older_than_30d'
  );

  if (purgeDailyStatsError) {
    const finishedAt = new Date();
    return NextResponse.json(
      {
        ok: false,
        error: 'DB',
        where: 'video_stats_daily',
        details: purgeDailyStatsError.message,
        parameters: { ttlHours: HYDRATION_TTL_HOURS ?? null },
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
      { status: 500 }
    );
  }

  // 실행 메타: 종료/소요 시간
  const finishedAt = new Date();

  return NextResponse.json({
    ok: true,
    parameters: { ttlHours: HYDRATION_TTL_HOURS ?? null },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    cutoffs: { videos: purgeVideosResult?.cutoff_kst ?? null, daily: purgeDailyStatsResult?.cutoff ?? null },
    deleted: { videos: purgeVideosResult?.deleted_count ?? 0, daily: purgeDailyStatsResult?.deleted_count ?? 0 },
  });
}
