import { NextResponse } from 'next/server';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { mapPublishedRowToItem, mapRankingRowToItem } from '@/lib/feed/transform';
import { createSupabaseServer } from '@/lib/supabase/server';

type PublishedCursorState = { mode: 'cache'; pivot: string | null };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isDebug = url.searchParams.get('debug') === '1';

  // 1) 입력 검증 (zod)
  let query;
  try {
    query = parseFeedQueryFromURL(url);
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid query', details: error?.issues ?? String(error) }, { status: 400 });
  }
  if (isDebug) console.log('[feed] query', query);

  //  스코프/플랫폼 파라미터
  const scope = (url.searchParams.get('scope') ?? 'all').toLowerCase(); // 'all' (기본)
  const platformParam = (url.searchParams.get('platform') ?? 'all').toLowerCase(); // 'all' | 'youtube' | 'chzzk'

  // 2) Supabase 클라이언트
  const supabase = await createSupabaseServer();

  // 3) 채널 집합 결정
  let channelIds: string[] = query.channelIds ?? [];
  if (!channelIds.length && scope === 'all') {
    // channelIds가 없으면 전체(또는 플랫폼별) 채널 id를 DB에서 채움
    let q = supabase.from('channels').select('id');
    if (platformParam === 'youtube' || platformParam === 'chzzk') {
      q = q.eq('platform', platformParam);
    }
    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
    }
    channelIds = (data ?? []).map((r: { id: string }) => r.id);
  }

  // 채널이 여전히 없으면 빈 응답
  if (!channelIds.length) {
    return NextResponse.json({ items: [], hasMore: false, cursor: null });
  }

  // 4) 정렬 분기 (RPC 호출)
  if (query.sort === 'published') {
    // 커서 해석
    const initialState: PublishedCursorState = query.cursor
      ? decodeCursor<PublishedCursorState>(query.cursor) ?? { mode: 'cache', pivot: null }
      : { mode: 'cache', pivot: null };

    const { data, error } = await supabase.rpc('rpc_feed_published_page', {
      p_channel_ids: channelIds,
      p_window_start: null,
      p_pivot: initialState.pivot, // 없으면 null
      p_limit: query.limit, // zod 기본값
      p_filter_type: query.filterType, // 'all' | 'video' | 'short' | 'live' | 'vod'
    });

    if (error) {
      return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
    }
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
    p_window_start: null,
    p_limit: query.limit,
    p_filter_type: query.filterType,
  });

  if (error) {
    return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
  }

  const rows: any[] = data?.rows ?? [];
  const sortKind: 'views_day' | 'views_week' = query.sort === 'views_day' ? 'views_day' : 'views_week';
  const items = rows.map((row) => mapRankingRowToItem(row, sortKind));

  // NOTE: 랭킹은 MVP에선 커서 미지원(첫 페이지 중심)
  const hasMore: boolean = !!data?.has_more;
  const nextCursor = null;

  return NextResponse.json({ items, hasMore, cursor: nextCursor });
}
