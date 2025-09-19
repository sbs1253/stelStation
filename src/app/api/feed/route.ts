// src/app/api/feed/route.ts
import { NextResponse } from 'next/server';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { mapPublishedRowToItem, mapRankingRowToItem } from '@/lib/feed/transform';
import { createSupabaseServer } from '@/lib/supabase/server';
import { makeChannelUrl, makeLiveUrl } from '@/lib/links';

type PublishedCursorState = { mode: 'cache'; pivot: string | null };

type ChannelMeta = {
  id: string;
  platform: 'youtube' | 'chzzk';
  platformChannelId: string | null;
  title: string | null;
  thumb: string | null;
  isLiveNow: boolean;
};

async function loadChannelMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  ids: string[]
): Promise<Record<string, ChannelMeta>> {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('channels')
    .select('id, platform, platform_channel_id, title, thumbnail_url, is_live_now')
    .in('id', ids);
  if (error || !data) return {};
  return Object.fromEntries(
    data.map((c: any) => [
      c.id,
      {
        id: c.id,
        platform: c.platform,
        platformChannelId: c.platform_channel_id ?? null,
        title: c.title ?? null,
        thumb: c.thumbnail_url ?? null,
        isLiveNow: !!c.is_live_now,
      } as ChannelMeta,
    ])
  );
}

function attachChannelMetaToItem(base: any, ch?: ChannelMeta) {
  if (!ch) return base;
  return {
    ...base,
    channel: {
      id: ch.id,
      platform: ch.platform,
      platformChannelId: ch.platformChannelId,
      title: ch.title,
      thumb: ch.thumb,
      isLiveNow: ch.isLiveNow,
      url: ch.platformChannelId ? makeChannelUrl(ch.platform as 'youtube' | 'chzzk', ch.platformChannelId) : undefined,
    },
  };
}

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

  //  스코프/플랫폼
  const scope = (url.searchParams.get('scope') ?? 'all').toLowerCase(); // 'all'
  const platformParam = (url.searchParams.get('platform') ?? 'all').toLowerCase(); // 'all'|'youtube'|'chzzk'

  // 2) Supabase
  const supabase = await createSupabaseServer();

  // 3) 채널 집합 결정
  let channelIds: string[] = query.channelIds ?? [];
  if (!channelIds.length && scope === 'all') {
    let q = supabase.from('channels').select('id');
    if (platformParam === 'youtube' || platformParam === 'chzzk') {
      q = q.eq('platform', platformParam);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
    channelIds = (data ?? []).map((r: { id: string }) => r.id);
  }

  if (!channelIds.length) {
    return NextResponse.json({ items: [], hasMore: false, cursor: null });
  }

  // 4) LIVE 전용 분기: filterType=live 이면 현재 진행 중인 라이브 세션만 반환
  if (query.filterType === 'live') {
    type LiveCursor = { startedAt: string; channelId: string };
    const pivot = query.cursor ? decodeCursor<LiveCursor>(query.cursor) : null;

    const { data, error } = await supabase.rpc('rpc_feed_live_now_page', {
      p_channel_ids: channelIds,
      p_pivot: pivot ? { started_at: pivot.startedAt, channel_id: pivot.channelId } : null,
      p_limit: query.limit,
    });

    // 에러거나 rows 비어도 빈 배열 반환 (fallback 없음)
    if (error) {
      console.error('[feed] rpc_feed_live_now_page error', error);
      return NextResponse.json({ items: [], hasMore: false, cursor: null });
    }

    const rows: any[] = data?.rows ?? [];
    if (!rows.length) {
      return NextResponse.json({ items: [], hasMore: false, cursor: null });
    }

    // 채널 메타(썸네일/타이틀 등) 주입을 위해 채널 정보 로드
    const rowChannelIds = Array.from(new Set(rows.map((r) => r.channel_id)));
    const channelMap = await loadChannelMap(supabase, rowChannelIds);

    const items = rows.map((r) => {
      const ch = channelMap[r.channel_id]; // 선택적 (없어도 동작)
      const base = {
        videoId: r.live_id ? `live:${r.channel_id}:${r.live_id}` : `live:${r.channel_id}:now`,
        platform: (ch?.platform ?? r.platform ?? 'chzzk') as 'youtube' | 'chzzk',
        title: r.title, // RPC에서 이미 coalesce 처리됨
        thumb: r.thumbnail_url ?? ch?.thumb ?? null,
        publishedAt: r.started_at ?? null,
        durationSec: null,
        isLive: true,
        contentType: 'live' as const,
        // viewer_count는 현재 시청자 수로 stats.views에 태운다(프론트 UI 재사용)
        stats: { views: typeof r.viewer_count === 'number' ? r.viewer_count : null, likes: null },
        live: { isLiveNow: true, hadLive24h: true },
        url:
          ch?.platformChannelId ?? r.platform_channel_id
            ? makeLiveUrl(ch?.platformChannelId ?? r.platform_channel_id)
            : undefined,
      };

      return attachChannelMetaToItem(base, ch);
    });

    const nextPivot = data?.next_pivot ?? null;
    const hasMore = !!data?.has_more;
    const nextCursor =
      hasMore && nextPivot
        ? encodeCursor<LiveCursor>({ startedAt: nextPivot.started_at, channelId: nextPivot.channel_id })
        : null;

    return NextResponse.json({ items, hasMore, cursor: nextCursor });
  }

  // 4) 정렬 분기
  if (query.sort === 'published') {
    // 커서
    const initialState: PublishedCursorState = query.cursor
      ? decodeCursor<PublishedCursorState>(query.cursor) ?? { mode: 'cache', pivot: null }
      : { mode: 'cache', pivot: null };

    // RPC
    const { data, error } = await supabase.rpc('rpc_feed_published_page', {
      p_channel_ids: channelIds,
      p_window_start: null,
      p_pivot: initialState.pivot,
      p_limit: query.limit,
      p_filter_type: query.filterType, // 'all'|'video'|'short'|'live'|'vod'
    });
    if (error) return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });

    const rows: any[] = data?.rows ?? [];

    // 이 페이지에 등장한 채널 메타 일괄 로드
    const rowChannelIds = Array.from(new Set(rows.map((r) => r.channel_id).filter(Boolean)));
    const channelMap = await loadChannelMap(supabase, rowChannelIds);

    // 변환 + 채널 메타 주입 (platform_channel_id가 없으면 채워 넣음)
    const items = rows.map((row) => {
      const ch = channelMap[row.channel_id];
      const augmented =
        ch && row.platform_channel_id == null ? { ...row, platform_channel_id: ch.platformChannelId } : row;
      const base = mapPublishedRowToItem(augmented);
      return attachChannelMetaToItem(base, ch);
    });

    const nextPivot: string | null = data?.next_pivot ?? null;
    const hasMore: boolean = !!data?.has_more;
    const nextCursor =
      hasMore && nextPivot ? encodeCursor<PublishedCursorState>({ mode: 'cache', pivot: nextPivot }) : null;

    return NextResponse.json({ items, hasMore, cursor: nextCursor });
  }

  // 인기순(Δ)
  // --- 랭킹 커서 타입
  type RankingCursor = { ordDelta: number; publishedAt: string; id: string };

  if (query.sort === 'views_day' || query.sort === 'views_week') {
    const isDay = query.sort === 'views_day';
    const rpcName = isDay ? 'rpc_feed_ranking_day_page' : 'rpc_feed_ranking_week_page';

    // 커서 decode
    const pivot = query.cursor ? decodeCursor<RankingCursor>(query.cursor) : null;

    const { data, error } = await supabase.rpc(rpcName, {
      p_channel_ids: channelIds,
      p_window_start: null,
      p_pivot: pivot ? { ord_delta: pivot.ordDelta, published_at: pivot.publishedAt, id: pivot.id } : null,
      p_limit: query.limit,
      p_filter_type: query.filterType,
    });
    if (error) {
      return NextResponse.json({ error: 'DB error', details: error.message }, { status: 500 });
    }

    const rows: any[] = data?.rows ?? [];

    // 채널 메타 로딩 & 주입 (현재 구조 유지)
    const channelIdsOnPage = Array.from(new Set(rows.map((r) => r.channel_id)));
    const { data: chRows } = await supabase
      .from('channels')
      .select('id, platform, platform_channel_id, title, thumbnail_url, is_live_now')
      .in('id', channelIdsOnPage);

    const channelMap = (chRows ?? []).reduce<Record<string, any>>((acc, c) => {
      acc[c.id] = {
        id: c.id,
        platform: c.platform,
        platformChannelId: c.platform_channel_id ?? null,
        title: c.title ?? null,
        thumb: c.thumbnail_url ?? null,
        isLiveNow: !!c.is_live_now,
      };
      return acc;
    }, {});

    const sortKind: 'views_day' | 'views_week' = isDay ? 'views_day' : 'views_week';
    const items = rows.map((row) => {
      const ch = channelMap[row.channel_id];
      const augmented =
        ch && row.platform_channel_id == null ? { ...row, platform_channel_id: ch.platformChannelId } : row;

      const base = mapRankingRowToItem(augmented, sortKind);
      return ch
        ? {
            ...base,
            channel: {
              id: ch.id,
              platform: ch.platform,
              platformChannelId: ch.platformChannelId,
              title: ch.title,
              thumb: ch.thumb,
              isLiveNow: ch.isLiveNow,
              url: ch.platformChannelId
                ? makeChannelUrl(ch.platform as 'youtube' | 'chzzk', ch.platformChannelId)
                : undefined,
            },
          }
        : base;
    });

    // 커서 encode (next_pivot → cursor)
    const nextPivot = data?.next_pivot ?? null;
    const hasMore = !!data?.has_more;

    const nextCursor =
      hasMore && nextPivot
        ? encodeCursor<RankingCursor>({
            ordDelta: Number(nextPivot.ord_delta),
            publishedAt: nextPivot.published_at,
            id: nextPivot.id,
          })
        : null;

    return NextResponse.json({ items, hasMore, cursor: nextCursor });
  }
  return NextResponse.json({ error: 'Invalid sort' }, { status: 400 });
}
