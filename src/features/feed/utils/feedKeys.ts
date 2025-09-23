import type { ContentFilterType, PlatformType } from '../types';

export const feedKeys = {
  all: (p: { platform: PlatformType; sort: 'published' | 'views_day' | 'views_week'; filterType: ContentFilterType }) =>
    ['feed', p] as const,
};
