export type ContentFilterType = 'all' | 'video' | 'short' | 'live' | 'vod';
export type PlatformType = 'all' | 'youtube' | 'chzzk';

export type FeedItem = {
  videoId: string;
  platform: PlatformType;
  channel: {
    id: string;
    platform: PlatformType;
    platformChannelId: string;
    title: string;
    thumb: string | null;
    isLiveNow: boolean;
    url: string;
  };
  title: string;
  thumb: string | null;
  publishedAt: string | null;
  durationSec: number | null;
  isLive: boolean;
  contentType: ContentFilterType;
  stats?: { views?: number | null };
  live?: { isLiveNow: boolean; hadLive24h: boolean };
  url: string;
};
