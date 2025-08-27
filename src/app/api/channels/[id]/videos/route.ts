export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { createSupabaseServer } from '@/lib/supabase/server';
import { parseChannelVideosQueryFromURL } from '@/lib/validations/channels';
import { mapPublishedRowToItem } from '@/lib/feed/transform';

type VideoListCursor = { published_at: string; id: string };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const channelId = (await params)?.id;

  if (!channelId) {
    return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel id' }, { status: 400 });
  }

  const url = new URL(request.url);

  // 1) 입력 검증
  let query;
  try {
    query = parseChannelVideosQueryFromURL(url);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid query', details: error?.issues ?? String(error) }, { status: 400 });
  }

  // 2) Supabase
  const supabase = await createSupabaseServer();

  // 3) 커서 해석
  const pivot = query.cursor ? decodeCursor<VideoListCursor>(query.cursor) ?? null : null;

  // 4) RPC 호출
  const { data, error } = await supabase.rpc('rpc_channel_videos_page', {
    p_channel_id: channelId,
    ...(pivot && { pivot }),
    limit_count: query.limit,
  });

  if (error) {
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  const allRows: any[] = data ?? [];
  const hasMore = allRows.length > query.limit;
  const rows = hasMore ? allRows.slice(0, query.limit) : allRows;

  const items = rows.map(mapPublishedRowToItem);
  const last = rows[rows.length - 1];

  // 5) nextCursor 생성
  const nextCursor =
    hasMore && last
      ? encodeCursor<VideoListCursor>({
          published_at: last.published_at,
          id: last.id,
        })
      : null;

  return NextResponse.json({ items, hasMore, cursor: nextCursor });
}
