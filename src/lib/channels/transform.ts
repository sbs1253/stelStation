import { makeChannelUrl, makeLiveUrl } from '@/lib/links';

type Row = {
  channel_id: string;
  platform: 'youtube' | 'chzzk';
  platform_channel_id: string | null;
  title: string | null;
  thumbnail_url: string | null;
  is_live_now: boolean | null;
  last_live_ended_at: string | null;
  recent_published_at: string | null;
  video_count_120d: number | null;
};

export function mapChannelRowToItem(row: Row) {
  const platformChannelId = row.platform_channel_id ?? undefined;

  return {
    id: row.channel_id,
    platform: row.platform,
    platformChannelId,
    title: row.title ?? '',
    thumb: row.thumbnail_url ?? null,
    isLiveNow: !!row.is_live_now,
    lastLiveEndedAt: row.last_live_ended_at, // ISO | null
    recentPublishedAt: row.recent_published_at, // ISO | null
    videoCount120d: typeof row.video_count_120d === 'number' ? row.video_count_120d : 0,

    url: platformChannelId ? makeChannelUrl(row.platform, platformChannelId) : undefined,
    liveUrl:
      row.platform === 'chzzk' && platformChannelId && row.is_live_now ? makeLiveUrl(platformChannelId) : undefined,
  };
}
