import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

const DEFAULT_WINDOW_DAYS = 120;

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const url = new URL(request.url);
  const rawWindow = url.searchParams.get('windowDays');

  let windowDays: number | null = null;
  if (rawWindow != null) {
    const parsed = Number.parseInt(rawWindow, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid windowDays', details: { received: rawWindow } },
        { status: 400 }
      );
    }
    windowDays = parsed;
  }

  try {
    const rpcArgs = windowDays != null ? { p_window_days: windowDays } : undefined;
    const refreshResult = await supabaseService.rpc('rpc_refresh_video_rankings_all', rpcArgs);
    const finishedAt = new Date();

    if (refreshResult.error) {
      return NextResponse.json(
        {
          ok: false,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: { stage: 'refresh_rpc', details: refreshResult.error.message },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      parameters: { windowDays: windowDays ?? DEFAULT_WINDOW_DAYS },
      refresh: refreshResult.data ?? null,
    });
  } catch (e: unknown) {
    const finishedAt = new Date();
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        error: { stage: 'unexpected', details: message },
      },
      { status: 502 }
    );
  }
}
