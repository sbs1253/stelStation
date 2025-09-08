import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

export async function POST(request: Request) {
  // 0) 내부 인증
  const secretGot = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secretGot !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    // 1) 일일 스냅샷만 수행 (정리는 별도 라우트)
    const snapshotResult = await supabaseService.rpc('rpc_stats_snapshot_today');
    const finishedAt = new Date();

    if (snapshotResult.error) {
      return NextResponse.json(
        {
          ok: false,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: { stage: 'snapshot_rpc', details: snapshotResult.error.message },
        },
        { status: 500 }
      );
    }

    // 성공 응답(스냅샷 결과 그대로 반환)
    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      snapshot: snapshotResult.data ?? null,
    });
  } catch (e: any) {
    // 예기치 못한 네트워크/클라이언트 오류 등
    const finishedAt = new Date();
    return NextResponse.json(
      {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        error: { stage: 'unexpected', details: String(e?.message ?? e) },
      },
      { status: 502 }
    );
  }
}
