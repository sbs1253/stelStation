'use client';

import PlatformFilter from '@/features/feed/components/PlatformFilter';
import ResponsiveFilter from '@/features/feed/components/ResponsiveFilter';
import type { ContentFilterType, PlatformType } from '../../feed/types';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { trackChangeFilter, trackChangeTab, trackRefresh } from '@/lib/analytics/events';

type Props = {
  platform: PlatformType;
  sort: 'published' | 'views_day' | 'views_week';
  filterType: ContentFilterType;
  onChange: (key: 'platform' | 'sort' | 'filterType', value: string) => void;
  pendingPlatform: PlatformType | null;
  isFetching: boolean;
  refetch: () => void;
};

export default function FeedControls({
  platform,
  sort,
  filterType,
  onChange,
  pendingPlatform,
  isFetching,
  refetch,
}: Props) {
  const currentPlatform = pendingPlatform ?? platform;

  const handlePlatformChange = (next: PlatformType) => {
    if (!next) return;
    if (next === currentPlatform) return;
    trackChangeTab({ platform: next });
    onChange('platform', next);
  };

  const handleSortChange = (next: typeof sort) => {
    if (!next) return;
    if (next !== sort) {
      trackChangeFilter({ filter_name: 'sort', filter_value: next });
      onChange('sort', next);
    }
  };

  const handleFilterTypeChange = (next: ContentFilterType) => {
    if (!next) return;
    if (next !== filterType) {
      trackChangeFilter({ filter_name: 'contentType', filter_value: next });
      onChange('filterType', next);
    }
  };

  return (
    <div className="flex flex-col items-start gap-4 w-full min-w-0">
      <PlatformFilter
        value={currentPlatform}
        onChange={handlePlatformChange}
        disabled={isFetching}
      />
      <div className="flex place-items-center gap-4">
        <ResponsiveFilter
          sortFilter={sort}
          onSortFilterChange={handleSortChange}
          videoType={filterType}
          onVideoTypeChange={handleFilterTypeChange}
          platform={platform}
        />
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => {
            refetch();
            trackRefresh({ location: 'feed' });
          }}
          disabled={isFetching}
        >
          <RefreshCw className={` ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
