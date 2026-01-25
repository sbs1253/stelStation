import { useQuery } from '@tanstack/react-query';
import type { AdminFilters, KPIData, PlatformStats, ChannelStat, ContentTypeDistribution } from '../types';

type AdminStatsResponse = {
  kpi: KPIData;
  platformStats: PlatformStats[];
  channelStats: ChannelStat[];
  contentTypeDistribution: ContentTypeDistribution[];
  dateRange: {
    current: { start: string; end: string };
    previous: { start: string; end: string } | null;
  };
};

export function useAdminStats(filters: Partial<AdminFilters>) {
  const { channelIds = [], platform = 'all', dateRange = 'last_7_days' } = filters;

  return useQuery({
    queryKey: ['admin-stats', { platform, dateRange, channelIds }],
    queryFn: async (): Promise<AdminStatsResponse> => {
      const params = new URLSearchParams({
        platform,
        dateRange,
      });

      channelIds.forEach(id => params.append('channelIds', id));

      const res = await fetch(`/api/admin/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch admin stats');
      
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000, // 24시간
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7일
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
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
    queryKey: ['admin-top-videos', { platform, contentType, channelIds, limit }],
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