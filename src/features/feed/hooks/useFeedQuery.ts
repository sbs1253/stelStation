'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ContentFilterType, FeedItem, PlatformType, FeedScope, SortType } from '../types';
import { feedKeys } from '../utils/feedKeys';

export function useFeedQuery(params: {
  scope?: FeedScope;
  creatorId?: string | null;
  channelIds?: string[] | null;
  platform: PlatformType;
  sort: SortType;
  filterType: ContentFilterType;
}) {
  const { scope = 'all', creatorId = null, channelIds = null, platform, sort, filterType } = params;
  const isLiveTab = filterType === 'live';
  const serverPlatform = scope === 'channels' ? 'all' : platform;

  return useInfiniteQuery({
    queryKey: feedKeys.all({ scope, creatorId, channelIds, platform, sort, filterType }),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const qs = new URLSearchParams({
        scope,
        sort,
        platform: serverPlatform,
        filterType,
        limit: '24',
      });

      if (scope === 'creator' && creatorId) qs.set('creatorId', creatorId);
      if (scope === 'channels' && channelIds?.length) {
        Array.from(new Set(channelIds))
          .sort()
          .forEach((id) => qs.append('channelIds', id));
      }

      if (pageParam) qs.set('cursor', pageParam);

      const res = await fetch(`/api/feed?${qs.toString()}`, { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      return res.json() as Promise<{ items: FeedItem[]; hasMore: boolean; cursor: string | null }>;
    },
    getNextPageParam: (last) => (last.hasMore && last.cursor ? last.cursor : undefined),
    select: (data) => {
      const seen = new Set<string>();
      const out: FeedItem[] = [];
      for (const p of data.pages) {
        for (const it of p.items ?? []) {
          if (seen.has(it.videoId)) continue;
          if (scope === 'channels' && platform !== 'all' && it.platform !== platform) continue;
          seen.add(it.videoId);
          out.push(it);
        }
      }
      return out;
    },
    placeholderData: keepPreviousData,
    refetchInterval: isLiveTab ? 30_000 : 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
