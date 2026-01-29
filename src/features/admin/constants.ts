import type { DateRangeType, FilterOption, KPIData } from './types';

// ===== 날짜 범위 메타 정보 =====
export const DATE_RANGE_META: Record<DateRangeType, { label: string; compareLabel: string }> = {
  today_vs_yesterday: { label: '오늘 vs 어제', compareLabel: '어제 대비' },
  this_week_vs_last_week: { label: '이번주 vs 지난주', compareLabel: '지난주 대비' },
  last_7_days: { label: '최근 7일', compareLabel: '이전 7일 대비' },
  last_30_days: { label: '최근 30일', compareLabel: '이전 30일 대비' },
} as const;

// ===== 필터 옵션 상수 =====
export const DATE_RANGE_OPTIONS: FilterOption[] = [
  { value: 'today_vs_yesterday', label: '오늘 vs 어제' },
  { value: 'this_week_vs_last_week', label: '이번주 vs 지난주' },
  { value: 'last_7_days', label: '최근 7일' },
  { value: 'last_30_days', label: '최근 30일' },
];

export const PLATFORM_OPTIONS: FilterOption[] = [
  { value: 'all', label: '전체' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'chzzk', label: 'Chzzk' },
];

export const CONTENT_TYPE_OPTIONS: FilterOption[] = [
  { value: 'all', label: '전체' },
  { value: 'video', label: '영상' },
  { value: 'short', label: '쇼츠' },
  { value: 'vod', label: 'VOD' },
];

// ===== KPI 카드 설정 =====
export type KpiCardConfig = {
  key: keyof Pick<KPIData, 'totalViews' | 'totalVideos' | 'avgViews'>;
  changeKey: keyof Pick<KPIData, 'viewsChange' | 'videosChange' | 'avgViewsChange'>;
  title: string;
};

export const KPI_CARDS: KpiCardConfig[] = [
  { key: 'totalViews', changeKey: 'viewsChange', title: '총 조회수' },
  { key: 'totalVideos', changeKey: 'videosChange', title: '영상 수' },
  { key: 'avgViews', changeKey: 'avgViewsChange', title: '영상당 평균 조회수' },
];
