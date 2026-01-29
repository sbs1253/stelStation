export type DateRangeType = 'today_vs_yesterday' | 'this_week_vs_last_week' | 'last_7_days' | 'last_30_days';

export type PlatformType = 'all' | 'youtube' | 'chzzk';

export type ContentType = 'all' | 'video' | 'short' | 'vod';

// ===== 필터 옵션 =====
export type FilterValue = DateRangeType | PlatformType | ContentType;

export type FilterOption = {
  value: FilterValue;
  label: string;
};

// ===== 테이블 정렬 =====
export type SortKey = 'totalViews' | 'avgViews' | 'totalVideos' | 'viewsChange';

export type SortOrder = 'asc' | 'desc';

export type AdminFilters = {
  platform: PlatformType;
  dateRange: DateRangeType;
  channelIds: string[];
  contentType: ContentType;
};

// ===== KPI =====
export type KPIData = {
  totalViews: number;
  totalVideos: number;
  totalChannels: number;
  avgViews: number;
  viewsChange: number;
  videosChange: number;
  channelsChange: number;
  avgViewsChange: number;
};

// ===== 플랫폼별 통계 =====
export type PlatformStat = {
  platform: 'youtube' | 'chzzk';
  views: number;
  videos: number;
  avgViews: number;
};

// ===== 채널별 통계 =====
export type ChannelStat = {
  channelId: string;
  channelName: string;
  platform: 'youtube' | 'chzzk';
  generation?: number;
  totalViews: number;
  totalVideos: number;
  avgViews: number;
  viewsChange: number;
};

// ===== 콘텐츠 타입 분포 =====
export type ContentTypeStat = {
  type: 'video' | 'short' | 'vod';
  count: number;
  percentage: number;
};

// ===== 일별 조회수 =====
export type DailyView = {
  date: string;
  views: number;
};

// ===== API 응답 =====
export type AdminStatsResponse = {
  kpi: KPIData;
  platformStats: PlatformStat[];
  channelStats: ChannelStat[];
  contentTypeDistribution: ContentTypeStat[];
  dateRange: {
    current: { start: string; end: string };
    previous: { start: string; end: string } | null;
  };
  dailyViews: DailyView[];
};