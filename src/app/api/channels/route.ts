export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { createSupabaseServer } from '@/lib/supabase/server';
import { parseChannelListQueryFromURL } from '@/lib/validations/channels';
import { mapChannelRowToItem } from '@/lib/channels/transform';

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
