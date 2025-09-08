import { NextResponse } from 'next/server';

export type FailReasons = Record<string, number>;

export type OpCtx = {
  name: string;
  mode?: string;
  correlationId: string;
  startedAt: string;
  failReasons: FailReasons;
  meta?: Record<string, any>;
};

function nowIso() {
  return new Date().toISOString();
}

export function beginOp(name: string, req: Request, mode?: string, meta?: Record<string, any>): OpCtx {
  const hdrId = req.headers.get('x-correlation-id');
  const correlationId = hdrId || `${name}-${Date.now()}`;
  const ctx: OpCtx = {
    name,
    mode,
    correlationId,
    startedAt: nowIso(),
    failReasons: {},
    meta,
  };
  console.info(
    JSON.stringify({ event: 'op-start', name, mode, correlationId: ctx.correlationId, meta, ts: ctx.startedAt })
  );
  return ctx;
}

export function bumpFail(ctx: OpCtx, key: string) {
  ctx.failReasons[key] = (ctx.failReasons[key] ?? 0) + 1;
}

export function ok<T = any>(ctx: OpCtx, result: T, extra?: Partial<{ meta: any; status: number }>) {
  const finishedAt = nowIso();
  const durationMs = new Date(finishedAt).getTime() - new Date(ctx.startedAt).getTime();
  const body = {
    ok: true,
    status: extra?.status ?? 200,
    v: 1,
    correlationId: ctx.correlationId,
    startedAt: ctx.startedAt,
    finishedAt,
    durationMs,
    name: ctx.name,
    ...(ctx.mode ? { mode: ctx.mode } : {}),
    ...(ctx.meta ? { meta: ctx.meta } : {}),
    result,
    ...(Object.keys(ctx.failReasons).length ? { failReasons: ctx.failReasons } : {}),
  };
  console.info(
    JSON.stringify({
      event: 'op-end',
      ok: true,
      name: ctx.name,
      mode: ctx.mode,
      correlationId: ctx.correlationId,
      durationMs,
      failReasons: ctx.failReasons,
      ts: finishedAt,
    })
  );
  return NextResponse.json(body, { status: body.status });
}

export function err(ctx: OpCtx, status: number, code: string, message: string, details?: any) {
  const finishedAt = nowIso();
  const durationMs = new Date(finishedAt).getTime() - new Date(ctx.startedAt).getTime();
  const body = {
    ok: false,
    status,
    v: 1,
    correlationId: ctx.correlationId,
    startedAt: ctx.startedAt,
    finishedAt,
    durationMs,
    name: ctx.name,
    ...(ctx.mode ? { mode: ctx.mode } : {}),
    error: { code, message, details },
    ...(Object.keys(ctx.failReasons).length ? { failReasons: ctx.failReasons } : {}),
  };
  console.error(
    JSON.stringify({
      event: 'op-end',
      ok: false,
      name: ctx.name,
      mode: ctx.mode,
      correlationId: ctx.correlationId,
      status,
      code,
      message,
      details,
      ts: finishedAt,
    })
  );
  return NextResponse.json(body, { status });
}
