import { createSupabaseServer } from '@/lib/supabase/server';
import { encodeCursor, decodeCursor } from '@/lib/paging/cursor';
import { mapPublishedRowToItem, mapRankingRowToItem } from '@/lib/feed/transform';
import { makeChannelUrl, makeLiveUrl } from '@/lib/links';

export type FeedScope = 'all' | 'creator' | 'channels';

export type FeedParams = {
  scope: FeedScope; // 'all' | 'creator' | 'channels'
  creatorId?: string | null;
  channelIds?: string[] | null;

  platform: 'all' | 'youtube' | 'chzzk';
  sort: 'published' | 'views_day' | 'views_week';
  filterType: 'all' | 'video' | 'short' | 'live' | 'vod';
  limit: number;
  cursor?: string | null;
};

export type FeedPage = { items: any[]; hasMore: boolean; cursor: string | null };

type PublishedCursorState = { mode: 'cache'; pivot: string | null };
type RankingCursor = { ordDelta: number; publishedAt: string; id: string };
type LiveCursor = { liveStateUpdatedAt: string; channelId: string };

type ChannelMeta = {
  id: string;
  platform: 'youtube' | 'chzzk';
  platformChannelId: string | null;
  title: string | null;
  thumb: string | null;
  isLiveNow: boolean;
};

export async function getFeedData(params: FeedParams): Promise<FeedPage> {
  const supabase = await createSupabaseServer();

  // 1) scope 해석 → 채널 집합
  const channelIds = await resolveChannelIds({
    supabase,
    scope: params.scope,
    creatorId: params.creatorId ?? null,
    channelIds: params.channelIds ?? null,
    platform: params.platform,
  });

  if (!channelIds.length) {
    return { items: [], hasMore: false, cursor: null };
  }

  // 2) LIVE 전용 빠른 경로
  if (params.filterType === 'live') {
    return getLivePage({ supabase, channelIds, params });
  }

  // 3) sort 분기
  if (params.sort === 'published') {
    return getPublishedPage({ supabase, channelIds, params });
  }

  if (params.sort === 'views_day' || params.sort === 'views_week') {
    return getRankingPage({ supabase, channelIds, params });
  }

  return { items: [], hasMore: false, cursor: null };
}

async function resolveChannelIds(ctx: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  scope: FeedScope;
  creatorId: string | null;
  channelIds: string[] | null;
  platform: 'all' | 'youtube' | 'chzzk';
}): Promise<string[]> {
  const { supabase, scope, creatorId, channelIds, platform } = ctx;

  // scope=channels: 넘겨준 목록 그대로 사용
  if (scope === 'channels') {
    return (channelIds ?? []).filter(Boolean);
  }

  // scope=creator: 크리에이터 소유 채널 조회 (테이블명/스키마는 프로젝트에 맞게 조정)
  if (scope === 'creator') {
    if (!creatorId) return [];
    // 예시: creators_channels(creator_id, channel_id)
    const { data, error } = await supabase.from('creators_channels').select('channel_id').eq('creator_id', creatorId);
    if (error || !data) return [];
    return data.map((r: any) => r.channel_id).filter(Boolean);
  }

  // scope=all: 전체 채널(플랫폼 필터 포함)
  let q = supabase.from('channels').select('id');
  if (platform === 'youtube' || platform === 'chzzk') q = q.eq('platform', platform);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r: { id: string }) => r.id);
}

async function getLivePage(ctx: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  channelIds: string[];
  params: FeedParams;
}): Promise<FeedPage> {
  const { supabase, channelIds, params } = ctx;

  // 현재 구조상 live는 chzzk만 지원
  if (params.platform === 'youtube') {
    return { items: [], hasMore: false, cursor: null };
  }

  const pivot = params.cursor ? decodeCursor<LiveCursor>(params.cursor) : null;

  let liveQuery = supabase
    .from('channels')
    .select('*')
    .eq('platform', 'chzzk')
    .eq('is_live_now', true)
    .in('id', channelIds)
    .order('live_state_updated_at', { ascending: false })
    .order('id', { ascending: false });

  if (pivot) {
    liveQuery = liveQuery.or(
      `live_state_updated_at.lt.${pivot.liveStateUpdatedAt},and(live_state_updated_at.eq.${pivot.liveStateUpdatedAt},id.lt.${pivot.channelId})`
    );
  }

  liveQuery = liveQuery.limit(params.limit + 1);

  const { data: liveChannels, error } = await liveQuery;
  if (error) {
    console.error('[feed] live channels query error', error);
    return { items: [], hasMore: false, cursor: null };
  }

  const rows = liveChannels ?? [];
  const hasMore = rows.length > params.limit;
  const pageRows = hasMore ? rows.slice(0, params.limit) : rows;

  if (!pageRows.length) return { items: [], hasMore: false, cursor: null };

  const items = pageRows.map((ch: any) => ({
    videoId: ch.current_live_id ? `live:${ch.id}:${ch.current_live_id}` : `live:${ch.id}:now`,
    platform: ch.platform,
    title: ch.current_live_title || (ch.title ? `${ch.title} — LIVE` : 'LIVE'),
    thumb: ch.current_live_thumbnail || ch.thumbnail_url || null,
    publishedAt: ch.last_live_started_at,
    durationSec: null,
    isLive: true,
    contentType: 'live' as const,
    stats: { views: ch.current_live_viewer_count },
    live: { isLiveNow: true, hadLive24h: true },
    url: ch.platform_channel_id ? makeLiveUrl(ch.platform_channel_id) : undefined,
    channel: {
      id: ch.id,
      platform: ch.platform,
      platformChannelId: ch.platform_channel_id,
      title: ch.title,
      thumb: ch.thumbnail_url,
      isLiveNow: ch.is_live_now,
      url: ch.platform_channel_id
        ? makeChannelUrl(ch.platform as 'youtube' | 'chzzk', ch.platform_channel_id)
        : undefined,
    },
  }));

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor<LiveCursor>({ liveStateUpdatedAt: last.live_state_updated_at, channelId: last.id })
      : null;

  return { items, hasMore, cursor: nextCursor };
}

async function getPublishedPage(ctx: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  channelIds: string[];
  params: FeedParams;
}): Promise<FeedPage> {
  const { supabase, channelIds, params } = ctx;

  const initialState: PublishedCursorState = params.cursor
    ? decodeCursor<PublishedCursorState>(params.cursor) ?? { mode: 'cache', pivot: null }
    : { mode: 'cache', pivot: null };

  const { data, error } = await supabase.rpc('rpc_feed_published_page', {
    p_channel_ids: channelIds,
    p_window_start: null,
    p_pivot: initialState.pivot,
    p_limit: params.limit,
    p_filter_type: params.filterType,
  });
  if (error) return { items: [], hasMore: false, cursor: null };

  const rows: any[] = data?.rows ?? [];

  // 이 페이지에 등장한 채널 메타 일괄 로드
  const rowChannelIds = Array.from(new Set(rows.map((r) => r.channel_id).filter(Boolean)));
  const channelMap = await loadChannelMap(supabase, rowChannelIds);

  // 변환 + 채널 메타 주입
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

  return { items, hasMore, cursor: nextCursor };
}

async function getRankingPage(ctx: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  channelIds: string[];
  params: FeedParams;
}): Promise<FeedPage> {
  const { supabase, channelIds, params } = ctx;
  const isDay = params.sort === 'views_day';
  const rpcName = isDay ? 'rpc_feed_ranking_day_page' : 'rpc_feed_ranking_week_page';

  const pivot = params.cursor ? decodeCursor<RankingCursor>(params.cursor) : null;

  const { data, error } = await supabase.rpc(rpcName, {
    p_channel_ids: channelIds,
    p_window_start: null,
    p_pivot: pivot ? { ord_delta: pivot.ordDelta, published_at: pivot.publishedAt, id: pivot.id } : null,
    p_limit: params.limit,
    p_filter_type: params.filterType,
  });
  if (error) return { items: [], hasMore: false, cursor: null };

  const rows: any[] = data?.rows ?? [];

  // 채널 메타 로딩
  const channelIdsOnPage = Array.from(new Set(rows.map((r) => r.channel_id)));
  const { data: chRows } = await supabase
    .from('channels')
    .select('id, platform, platform_channel_id, title, thumbnail_url, is_live_now')
    .in('id', channelIdsOnPage);

  const channelMap: Record<string, ChannelMeta> = (chRows ?? []).reduce((acc, c: any) => {
    acc[c.id] = {
      id: c.id,
      platform: c.platform,
      platformChannelId: c.platform_channel_id ?? null,
      title: c.title ?? null,
      thumb: c.thumbnail_url ?? null,
      isLiveNow: !!c.is_live_now,
    };
    return acc;
  }, {} as Record<string, ChannelMeta>);

  const sortKind: 'views_day' | 'views_week' = isDay ? 'views_day' : 'views_week';
  const items = rows.map((row) => {
    const ch = channelMap[row.channel_id];
    const augmented =
      ch && row.platform_channel_id == null ? { ...row, platform_channel_id: ch.platformChannelId } : row;
    const base = mapRankingRowToItem(augmented, sortKind);
    return attachChannelMetaToItem(base, ch);
  });

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

  return { items, hasMore, cursor: nextCursor };
}

// ---- 보조 함수들-------------------------------

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
      url: ch.platformChannelId ? makeChannelUrl(ch.platform, ch.platformChannelId) : undefined,
    },
  };
}
