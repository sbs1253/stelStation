'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { ContentFilterType, PlatformType, FeedScope, SortType } from '@/features/feed/types';
import { ALLOWED_CONTENT_BY_PLATFORM } from '@/features/feed/types';

export function useUrlFeedState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [isNavPending, startTransition] = useTransition();
  const [pendingPlatform, setPendingPlatform] = useState<PlatformType | null>(null);

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

  const setParam = (key: 'platform' | 'sort' | 'filterType' | 'scope' | 'creatorId', value: string) => {
    const next = new URLSearchParams(sp.toString());
    const isDefault =
      (key === 'platform' && value === 'all') ||
      (key === 'sort' && value === 'published') ||
      (key === 'filterType' && value === 'all') ||
      (key === 'scope' && value === 'all') ||
      (key === 'creatorId' && value === '');

    if (isDefault) next.delete(key);
    else next.set(key, value);

    if (key === 'platform') {
      setPendingPlatform(value as PlatformType);
      next.delete('filterType');
    }

    commit(next);
  };

  const setChannelIds = (ids: string[]) => {
    const next = new URLSearchParams(sp.toString());
    next.delete('channelIds');
    Array.from(new Set(ids))
      .sort()
      .forEach((id) => next.append('channelIds', id));
    commit(next);
  };

  useEffect(() => {
    // 최초 1회만 URL 정규화 -> url로 진입시 초기화 위함
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
    setParam,
    setChannelIds,
  };
}
