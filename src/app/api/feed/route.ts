// Node 런타임
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';
import { RECENT_WINDOW_DAYS } from '@/lib/config/constants';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { mapPublishedRowToItem, mapRankingRowToItem } from '@/lib/feed/transform';
import { createSupabaseServer } from '@/lib/supabase/server';

type PublishedCursorState = { mode: 'cache'; pivot: string | null };

export async function GET(request: Request) {
  const url = new URL(request.url);

  // 1) 입력 검증 (zod)
  let query;
  try {
    query = parseFeedQueryFromURL(url);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid query', details: error?.issues ?? String(error) }, { status: 400 });
  }
  console.log(query);
  // 2) 채널 집합(게스트 기준: channelIds 필요)
  const channelIds = query.channelIds ?? [];
  if (!channelIds.length) {
    return NextResponse.json({ items: [], hasMore: false, cursor: null });
  }

  // 3) 최근 120일 경계 계산 (ISO)
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - RECENT_WINDOW_DAYS);
  const windowStartISO = windowStart.toISOString();

  // 4) Supabase 클라이언트
  const supabase = await createSupabaseServer();

  // 5) 정렬 분기 (RPC 호출)
  if (query.sort === 'published') {
    // 커서 해석
    const initialState: PublishedCursorState = query.cursor
      ? decodeCursor<PublishedCursorState>(query.cursor) ?? { mode: 'cache', pivot: null }
      : { mode: 'cache', pivot: null };

    const { data, error } = await supabase.rpc('rpc_feed_published_page', {
      p_channel_ids: channelIds,
      p_window_start: windowStartISO,
      p_pivot: initialState.pivot, // 없으면 null
      p_limit: query.limit, // zod가 기본값 보장
      p_filter_type: query.filterType, // 'all' | 'video' | 'short' | 'live' | 'vod'
    });

    if (error) {
      return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
    }

    // data 형태: { rows: [...], next_pivot: timestamptz|null, has_more: boolean }
    const rows: any[] = data?.rows ?? [];
    const items = rows.map(mapPublishedRowToItem);

    const nextPivot: string | null = data?.next_pivot ?? null;
    const hasMore: boolean = !!data?.has_more;

    const nextCursor =
      hasMore && nextPivot ? encodeCursor<PublishedCursorState>({ mode: 'cache', pivot: nextPivot }) : null;

    return NextResponse.json({ items, hasMore, cursor: nextCursor });
  }

  // 인기순(Δ): Day / Week — baseline(KST 어제/7일전)은 RPC 내부에서 계산
  const rpcName = query.sort === 'views_day' ? 'rpc_feed_ranking_day' : 'rpc_feed_ranking_week';

  const { data, error } = await supabase.rpc(rpcName, {
    p_channel_ids: channelIds,
    p_window_start: windowStartISO,
    p_limit: query.limit,
    p_filter_type: query.filterType,
  });

  if (error) {
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  // data 형태: { rows: [...(delta_views 포함)], has_more: boolean }
  const rows: any[] = data?.rows ?? [];
  const sortKind: 'views_day' | 'views_week' = query.sort === 'views_day' ? 'views_day' : 'views_week';
  const items = rows.map((row) => mapRankingRowToItem(row, sortKind));

  // NOTE: 랭킹은 MVP에선 커서 페이지네이션 미지원(첫 페이지 중심)
  const hasMore: boolean = !!data?.has_more;
  const nextCursor = null;

  return NextResponse.json({ items, hasMore, cursor: nextCursor });
}
