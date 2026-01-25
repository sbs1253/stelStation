export type DateRange = 
  | 'today_vs_yesterday'
  | 'this_week_vs_last_week'
  | 'last_7_days'
  | 'last_30_days';

export type SortBy = 'views' | 'generation' | 'channel_name';

export type AdminFilters = {
  channelIds: string[];
  platform: 'all' | 'youtube' | 'chzzk';
  dateRange: DateRange;
  contentType: 'all' | 'video' | 'short' | 'vod';
  sortBy: SortBy;
};

export type KPIData = {
  totalViews: number;
  totalVideos: number;
  totalChannels: number;
  avgViews: number;
  // 증감률 (전 기간 대비)
  viewsChange?: number;
  videosChange?: number;
  channelsChange?: number;
  avgViewsChange?: number;
};

export type PlatformStats = {
  platform: 'youtube' | 'chzzk';
  views: number;
  videos: number;
  avgViews: number;
};

export type TrendDataPoint = {
  date: string;
  views: number;
  videos: number;
  label?: string; // "오늘", "어제" 등
};

export type ContentTypeDistribution = {
  type: 'video' | 'short' | 'vod';
  count: number;
  percentage: number;
};

export type ChannelStat = {
  channelId: string;
  channelName: string;
  platform: 'youtube' | 'chzzk';
  generation?: number;
  totalViews: number;
  totalVideos: number;
  avgViews: number;
  topVideo?: {
    title: string;
    views: number;
    publishedAt: string;
  };
  // 증감률
  viewsChange?: number;
};

export type TopVideo = {
  videoId: string;
  title: string;
  channelName: string;
  platform: 'youtube' | 'chzzk';
  contentType: 'video' | 'short' | 'vod';
  views: number;
  publishedAt: string;
  thumbnailUrl?: string;
};