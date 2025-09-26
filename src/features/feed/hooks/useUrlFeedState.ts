'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { ContentFilterType, PlatformType, FeedScope, SortType } from '@/features/feed/types';
import { ALLOWED_CONTENT_BY_PLATFORM } from '@/features/feed/types';

type UrlUpdate = Partial<{
  platform: PlatformType;
  sort: SortType;
  filterType: ContentFilterType;
  scope: FeedScope;
  creatorId: string | null;
  channelIds: string[];
}>;

const DEFAULTS = {
  platform: 'all' as PlatformType,
  sort: 'published' as SortType,
  filterType: 'all' as ContentFilterType,
  scope: 'all' as FeedScope,
  creatorId: '',
};

export function useUrlFeedState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [isNavPending, startTransition] = useTransition();
  const [pendingPlatform, setPendingPlatform] = useState<PlatformType | null>(null);

  // 현재 URL 상태 파싱
  const scope = ((sp.get('scope') ?? 'all') as FeedScope) || 'all';
  const creatorId = sp.get('creatorId') ?? null;
  const channelIds = sp.getAll('channelIds') ?? [];
  const platform = (sp.get('platform') ?? 'all') as PlatformType;
  const sort = (sp.get('sort') ?? 'published') as SortType;
  const rawType = (sp.get('filterType') ?? 'all') as ContentFilterType;

  const allowed = ALLOWED_CONTENT_BY_PLATFORM[platform];
  const filterType = (allowed.includes(rawType) ? rawType : 'all') as ContentFilterType;

  const commit = (next: URLSearchParams) => {
    if (next.toString() === sp.toString()) return;
    startTransition(() => {
      router.replace(next.size ? `${pathname}?${next.toString()}` : pathname);
    });
  };

  const setParams = (updates: UrlUpdate) => {
    const next = new URLSearchParams(sp.toString());

    if (updates.platform) {
      setPendingPlatform(updates.platform);
      next.delete('filterType');
    }

    const applyKV = (key: keyof typeof DEFAULTS, value: string | null | undefined) => {
      if (value == null || value === DEFAULTS[key]) next.delete(key);
      else next.set(key, value);
    };

    if ('platform' in updates) applyKV('platform', updates.platform ?? null);
    if ('sort' in updates) applyKV('sort', updates.sort ?? null);
    if ('filterType' in updates) applyKV('filterType', updates.filterType ?? null);
    if ('scope' in updates) applyKV('scope', updates.scope ?? null);
    if ('creatorId' in updates) applyKV('creatorId', updates.creatorId ?? '');

    if ('channelIds' in updates) {
      next.delete('channelIds');
      const ids = Array.from(new Set(updates.channelIds ?? []))
        .filter(Boolean)
        .sort();
      ids.forEach((id) => next.append('channelIds', id));
    }

    commit(next);
  };

  const setParam = (key: 'platform' | 'sort' | 'filterType' | 'scope' | 'creatorId', value: string) => {
    setParams({ [key]: value } as UrlUpdate);
  };

  useEffect(() => {
    if (!allowed.includes(rawType)) {
      const next = new URLSearchParams(sp.toString());
      next.delete('filterType');
      commit(next);
    }
  }, []);

  useEffect(() => {
    if (pendingPlatform && platform === pendingPlatform) setPendingPlatform(null);
  }, [platform, pendingPlatform]);

  return {
    // URL 상태
    scope,
    creatorId,
    channelIds,
    platform,
    sort,
    filterType,
    // 네비 상태
    pendingPlatform,
    isNavPending,
    // setter
    setParams,
    setParam,
  };
}
