export type PlatformType = 'all' | 'youtube' | 'chzzk';
export type SortType = 'published' | 'views_day' | 'views_week';
export type ContentFilterType = 'all' | 'video' | 'short' | 'live' | 'vod';
export type FeedScope = 'all' | 'creator' | 'channels';

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

// 플랫폼별 허용 콘텐츠 타입 (UI/훅에서 공통 사용)
export const ALLOWED_CONTENT_BY_PLATFORM: Readonly<Record<PlatformType, readonly ContentFilterType[]>> = {
  all: ['all', 'video', 'short', 'vod', 'live'],
  youtube: ['all', 'video', 'short'],
  chzzk: ['all', 'vod', 'live'],
} as const;
