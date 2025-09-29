'use client';

import PlatformFilter from '@/features/feed/components/PlatformFilter';
import ResponsiveFilter from '@/features/feed/components/ResponsiveFilter';
import type { ContentFilterType, PlatformType } from '../../feed/types';
import { RefreshButton } from '@/features/feed/components/RefreshButton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

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
  return (
    <div className="flex flex-col items-start gap-4 w-full min-w-0">
      <PlatformFilter
        value={pendingPlatform ?? platform}
        onChange={(v) => onChange('platform', v)}
        disabled={isFetching}
      />
      <div className="flex place-items-center gap-4">
        <ResponsiveFilter
          sortFilter={sort}
          onSortFilterChange={(v) => onChange('sort', v)}
          videoType={filterType}
          onVideoTypeChange={(v) => onChange('filterType', v)}
          platform={platform}
        />
        <Button type="button" variant="default" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={` ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
