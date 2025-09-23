'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { ContentFilterType, PlatformType } from '../types';

const ALLOWED: Record<PlatformType, ContentFilterType[]> = {
  all: ['all', 'video', 'short', 'vod', 'live'],
  youtube: ['all', 'video', 'short'],
  chzzk: ['all', 'vod', 'live'],
};

export function useUrlFeedState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [isNavPending, startTransition] = useTransition();
  const [pendingPlatform, setPendingPlatform] = useState<PlatformType | null>(null);

  const platform = (sp.get('platform') ?? 'all') as PlatformType;
  const sort = (sp.get('sort') ?? 'published') as 'published' | 'views_day' | 'views_week';
  const rawType = (sp.get('filterType') ?? 'all') as ContentFilterType;
  const filterType = (ALLOWED[platform].includes(rawType) ? rawType : 'all') as ContentFilterType;

  const setParam = (key: 'platform' | 'sort' | 'filterType', value: string) => {
    const next = new URLSearchParams(sp.toString());

    const isDefault =
      (key === 'platform' && value === 'all') ||
      (key === 'sort' && value === 'published') ||
      (key === 'filterType' && value === 'all');

    if (isDefault) next.delete(key);
    else next.set(key, value);

    if (key === 'platform') setPendingPlatform(value as PlatformType);

    startTransition(() => {
      router.replace(next.size ? `${pathname}?${next.toString()}` : pathname);
    });
  };

  // 플랫폼 바뀔 때 허용되지 않는 필터 값이면 all로 교정
  useEffect(() => {
    if (!ALLOWED[platform].includes(filterType)) setParam('filterType', 'all');
  }, [platform]);

  useEffect(() => {
    if (pendingPlatform && platform === pendingPlatform) setPendingPlatform(null);
  }, [platform, pendingPlatform]);

  return {
    platform,
    sort,
    filterType,
    pendingPlatform,
    isNavPending,
    setParam,
  };
}
