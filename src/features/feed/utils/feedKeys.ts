import type { ContentFilterType, PlatformType, FeedScope } from '../types';

type Sort = 'published' | 'views_day' | 'views_week';

export const feedKeys = {
  all: (p: {
    scope?: FeedScope;
    platform: PlatformType;
    sort: Sort;
    filterType: ContentFilterType;
    creatorId?: string | null;
    channelIds?: string[] | null;
  }) => {
    const scope = p.scope ?? 'all';
    const base: Record<string, unknown> = {
      scope,
      sort: p.sort,
      filterType: p.filterType,
    };
    base.platform = p.platform;

    if (scope === 'channels' && p.channelIds?.length) {
      base.channelIds = Array.from(new Set(p.channelIds)).sort();
    }

    return ['feed', base] as const;
  },
};
