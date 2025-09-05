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

  // 1) 입력 검증 (zod in services/channels)
  let query;
  try {
    query = parseChannelListQueryFromURL(url);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid query', details: error?.issues ?? String(error) }, { status: 400 });
  }
  console.log('/channel', query);
  // 2) Supabase (server)
  const supabase = await createSupabaseServer();

  // 3) 커서 해석
  const pivot = query.cursor ? decodeCursor<ChannelListCursor>(query.cursor) ?? null : null;
  console.log(pivot);
  // 4) RPC 호출
  const { data, error } = await supabase.rpc('rpc_channels_page', {
    limit_count: query.limit,
    ...(pivot && { pivot }),
    ...(query.q && { q: query.q }),
  });
  console.log(data);
  if (error) {
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  const allRows: any[] = data ?? [];
  const hasMore = allRows.length > query.limit;
  const rows = hasMore ? allRows.slice(0, query.limit) : allRows;

  const items = rows.map(mapChannelRowToItem);

  const last = rows[rows.length - 1] ?? null;

  // 5) nextCursor 생성
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
  // 1) 헤더 보호
  if ((req.headers.get('x-cron-secret') ?? '') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2) 바디 검증
  let body: z.infer<typeof CreateChannelSchema>;
  try {
    body = CreateChannelSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body', details: e?.issues ?? String(e) }, { status: 400 });
  }

  // 3) 이미 존재하면 재사용
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

  // 4) 신규 생성
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
