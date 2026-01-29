import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminFilters, AdminStatsResponse, DateRangeType, PlatformType, ContentType } from '../types';

// ===== Query Key 생성 =====
export function adminStatsKey(filters: {
  platform: string;
  dateRange: string;
  channelIds: string[];
  contentType: string;
}) {
  return [
    'admin-stats',
    filters.platform,
    filters.dateRange,
    filters.contentType,
    filters.channelIds.join(','),
  ];
}

export function usePrefetchAdminStats() {
  const queryClient = useQueryClient();

  return (params: AdminFilters) => {
    queryClient.prefetchQuery({
      queryKey: adminStatsKey(params),
      queryFn: () => fetchAdminStats(params),
      staleTime: 24 * 60 * 60 * 1000,
    });
  };
}
async function fetchAdminStats(
  filters: AdminFilters,
  forceRefresh = false
): Promise<AdminStatsResponse> {
  const { channelIds = [], platform = 'all', dateRange = 'last_7_days', contentType = 'all' } = filters;

  const params = new URLSearchParams({
    platform,
    dateRange,
    contentType,
  });

  channelIds.forEach((id) => params.append('channelIds', id));

  // forceRefresh가 true면 캐시 무시
  if (forceRefresh) {
    params.append('_t', Date.now().toString());
  }

  const res = await fetch(`/api/admin/stats?${params.toString()}`, {
    cache: forceRefresh ? 'no-store' : 'default',
  });
  if (!res.ok) throw new Error('Failed to fetch admin stats');

  return res.json();
}
export function useAdminStats(filters: AdminFilters) {
  return useQuery({
    queryKey: adminStatsKey(filters),
    queryFn: () => fetchAdminStats(filters),

    placeholderData: (prev) => prev,
    staleTime: 24 * 60 * 60 * 1000, // 24시간
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7일
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ===== Force Refresh Hook (HTTP 캐시도 무시) =====
export function useRefreshAdminStats(filters: AdminFilters) {
  const queryClient = useQueryClient();

  return async () => {
    // HTTP 캐시 무시 + React Query 캐시 업데이트
    await queryClient.fetchQuery({
      queryKey: adminStatsKey(filters),
      queryFn: () => fetchAdminStats(filters, true), 
      staleTime: 0, // 즉시 stale 처리
    });
  };
}

// ===== Prefetch with Cache Check =====
export function usePrefetchIfNeeded(currentFilters: {
  platform: PlatformType;
  dateRange: DateRangeType;
  contentType: ContentType;
  channelIds: string[];
}) {
  const queryClient = useQueryClient();
  const prefetch = usePrefetchAdminStats();

  return (next: {
    platform?: PlatformType;
    dateRange?: DateRangeType;
    contentType?: ContentType;
  }) => {
    const nextFilters = {
      platform: next.platform ?? currentFilters.platform,
      dateRange: next.dateRange ?? currentFilters.dateRange,
      contentType: next.contentType ?? currentFilters.contentType,
      channelIds: currentFilters.channelIds,
    };
    const key = adminStatsKey(nextFilters);
    const state = queryClient.getQueryState(key);
    
    // 이미 fetching 중이거나 캐시가 있으면 skip
    if (state?.fetchStatus === 'fetching') return;
    if (state?.data) return;

    prefetch(nextFilters);
  };
}

// Top Videos Hook
export function useTopVideos(filters: {
  channelIds?: string[];
  platform?: 'all' | 'youtube' | 'chzzk';
  contentType?: 'all' | 'video' | 'short' | 'vod';
  limit?: number;
}) {
  const { channelIds = [], platform = 'all', contentType = 'all', limit = 10 } = filters;

  return useQuery({
    queryKey: ['admin-top-videos', { platform, contentType, channelIds: channelIds.join(','), limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        platform,
        contentType,
        limit: limit.toString(),
      });

      channelIds.forEach(id => params.append('channelIds', id));

      const res = await fetch(`/api/admin/top-videos?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch top videos');
      
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

