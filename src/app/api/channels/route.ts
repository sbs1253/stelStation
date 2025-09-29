import { NextResponse } from 'next/server';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { createSupabaseServer } from '@/lib/supabase/server';
import { parseChannelListQueryFromURL } from '@/lib/validations/channels';
import { mapChannelRowToItem } from '@/lib/channels/transform';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';

type ChannelListCursor = { recent_published_at: string | null; channel_id: string };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isDebug = url.searchParams.get('debug') === '1';

  let query;
  try {
    query = parseChannelListQueryFromURL(url); // limit, cursor, q
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid query', details: error?.issues ?? String(error) }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const pivot = query.cursor ? decodeCursor<ChannelListCursor>(query.cursor) ?? null : null;

  const { data, error } = await supabase.rpc('rpc_channels_page', {
    limit_count: query.limit,
    ...(pivot && { pivot }),
    ...(query.q && { q: query.q }),
  });
  if (error) {
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  const allRows: any[] = data ?? [];
  const hasMore = allRows.length > query.limit;
  const rows = hasMore ? allRows.slice(0, query.limit) : allRows;

  const channelIdsOnPage = rows.map((r: any) => r.channel_id);
  const { data: ccRows, error: ccErr } = await supabaseService
    .from('creator_channels')
    .select('channel_id, creator_id')
    .in('channel_id', channelIdsOnPage);
  if (ccErr) {
    return NextResponse.json({ error: 'DB error', details: ccErr.message }, { status: 500 });
  }
  const creatorIds = Array.from(new Set((ccRows ?? []).map((r: any) => r.creator_id).filter(Boolean)));
  let creatorRows: any[] = [];
  if (creatorIds.length) {
    const { data, error: creatorErr } = await supabaseService
      .from('creators')
      .select('id, x_url')
      .in('id', creatorIds);
    if (creatorErr) {
      return NextResponse.json({ error: 'DB error', details: creatorErr.message }, { status: 500 });
    }
    creatorRows = data ?? [];
  }
  const xUrlByCreator: Record<string, string | null> = creatorRows.reduce(
    (acc: Record<string, string | null>, row: any) => {
      acc[row.id] = row.x_url ?? null;
      return acc;
    },
    {}
  );
  const creatorByChannel: Record<string, { id: string; x: string | null }> = (ccRows ?? []).reduce(
    (acc: Record<string, { id: string; x: string | null }>, r: any) => {
      acc[r.channel_id] = {
        id: r.creator_id,
        x: xUrlByCreator[r.creator_id] ?? null,
      };
      return acc;
    },
    {}
  );

  const items = rows.map((row: any) => {
    const base = mapChannelRowToItem(row);
    const meta = creatorByChannel[row.channel_id];
    return {
      ...base,
      creatorId: meta?.id ?? null,
      creatorX: meta?.x ?? null,
    };
  });

  const last = rows[rows.length - 1] ?? null;
  const nextCursor =
    hasMore && last
      ? encodeCursor<ChannelListCursor>({
          recent_published_at: last.recent_published_at,
          channel_id: last.channel_id,
        })
      : null;

  return NextResponse.json({ items, hasMore, cursor: nextCursor });
}

const ADMIN_SECRET = process.env.CRON_SECRET ?? '';
const CreateChannelSchema = z.object({
  platform: z.enum(['youtube', 'chzzk']),
  platformChannelId: z.string().min(1),
  title: z.string().optional(),
  thumbnailUrl: z.string().optional(),
});
export async function POST(req: Request) {
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: z.infer<typeof CreateChannelSchema>;
  try {
    body = CreateChannelSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  const { data: existing, error: selErr } = await supabaseService
    .from('channels')
    .select('id')
    .eq('platform', body.platform)
    .eq('platform_channel_id', body.platformChannelId)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ error: 'DB error', details: selErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ created: false, id: existing.id });
  }

  const { data: inserted, error: insErr } = await supabaseService
    .from('channels')
    .insert({
      platform: body.platform,
      platform_channel_id: body.platformChannelId,
      title: body.title ?? null,
      thumbnail_url: body.thumbnailUrl ?? null,
    })
    .select('id')
    .single();
  if (insErr) {
    return NextResponse.json({ error: 'DB error', details: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ created: true, id: inserted.id });
}
