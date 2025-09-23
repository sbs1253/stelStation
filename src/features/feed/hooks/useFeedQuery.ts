'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ContentFilterType, FeedItem, PlatformType } from '../types';
import { feedKeys } from '../utils/feedKeys';

export function useFeedQuery(params: {
  platform: PlatformType;
  sort: 'published' | 'views_day' | 'views_week';
  filterType: ContentFilterType;
}) {
  const { platform, sort, filterType } = params;
  const isLiveTab = filterType === 'live';

  return useInfiniteQuery({
    queryKey: feedKeys.all({ platform, sort, filterType }),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const qs = new URLSearchParams({
        scope: 'all',
        sort,
        platform,
        filterType,
        limit: '24',
      });
      if (pageParam) qs.set('cursor', pageParam);
      const res = await fetch(`/api/feed?${qs.toString()}`, { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      return res.json() as Promise<{ items: FeedItem[]; hasMore: boolean; cursor: string | null }>;
    },
    getNextPageParam: (last) => (last.hasMore && last.cursor ? last.cursor : undefined),
    // 평탄화 + 중복 제거
    select: (data) => {
      const seen = new Set<string>();
      const out: FeedItem[] = [];
      for (const p of data.pages) {
        for (const it of p.items ?? []) {
          if (!seen.has(it.videoId)) {
            seen.add(it.videoId);
            out.push(it);
          }
        }
      }
      return out;
    },
    placeholderData: keepPreviousData,
    refetchInterval: isLiveTab ? 30_000 : 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
