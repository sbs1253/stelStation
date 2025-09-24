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
      platform: p.platform,
      sort: p.sort,
      filterType: p.filterType,
    };

    if (scope === 'creator' && p.creatorId) {
      base.creatorId = p.creatorId;
    }

    if (scope === 'channels' && p.channelIds?.length) {
      // 순서/중복에 영향받지 않도록 정규화
      base.channelIds = Array.from(new Set(p.channelIds)).sort();
    }

    return ['feed', base] as const;
  },
};
