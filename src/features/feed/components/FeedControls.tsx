'use client';

import PlatformFilter from '@/features/feed/components/PlatformFilter';
import ResponsiveFilter from '@/features/feed/components/ResponsiveFilter';
import type { ContentFilterType, PlatformType } from '../../feed/types';

type Props = {
  platform: PlatformType;
  sort: 'published' | 'views_day' | 'views_week';
  filterType: ContentFilterType;
  onChange: (key: 'platform' | 'sort' | 'filterType', value: string) => void;
  pendingPlatform: PlatformType | null;
  isNavPending: boolean;
};

export default function FeedControls({ platform, sort, filterType, onChange, pendingPlatform, isNavPending }: Props) {
  return (
    <div className="flex flex-col items-start gap-4 w-full min-w-0">
      <PlatformFilter
        value={pendingPlatform ?? platform}
        onChange={(v) => onChange('platform', v)}
        disabled={isNavPending}
      />
      <div className="flex">
        <ResponsiveFilter
          sortFilter={sort}
          onSortFilterChange={(v) => onChange('sort', v)}
          videoType={filterType}
          onVideoTypeChange={(v) => onChange('filterType', v)}
          platform={platform}
        />
      </div>
    </div>
  );
}
