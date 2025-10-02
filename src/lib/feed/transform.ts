import { makeVideoUrl } from '@/lib/links';

/** RPC row → API item (최신순/공통) */
export function mapPublishedRowToItem(row: any) {
  const contentType = row.content_type as 'video' | 'short' | 'live' | 'vod' | undefined;
  const isLiveContent = contentType === 'live';

  const url =
    makeVideoUrl({
      platform: row.platform,
      platformChannelId: row.platform_channel_id,
      platformVideoId: row.platform_video_id,
      isLive: isLiveContent,
      contentType,
      chzzkVideoNo: row.chzzk_video_no,
    }) ?? undefined;

  return {
    videoId: row.platform_video_id,
    platform: row.platform,
    channel: { id: row.channel_id, title: undefined, thumb: undefined },
    title: row.title,
    thumb: row.thumbnail_url ?? null,
    publishedAt: row.published_at,
    durationSec: row.duration_sec ?? null,
    isLive: isLiveContent,
    contentType,
    stats: {
      views: row.view_count ?? null,
      likes: row.like_count ?? null,
    },
    live: {
      isLiveNow: !!row.is_live_now,
      hadLive24h: !!row.had_live_24h,
    },
    url,
  };
}

/** RPC row( delta_views 포함 ) → API item (랭킹) */
export function mapRankingRowToItem(row: any, sortKind: 'views_day' | 'views_week') {
  const base = mapPublishedRowToItem(row);
  const delta = typeof row.delta_views === 'number' ? row.delta_views : undefined;

  return sortKind === 'views_day'
    ? { ...base, rank: { deltaViewsDay: delta } }
    : { ...base, rank: { deltaViewsWeek: delta } };
}
