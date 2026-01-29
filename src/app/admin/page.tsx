'use client';

import { useMemo, useState } from 'react';
import { useAdminStats, usePrefetchIfNeeded, useRefreshAdminStats } from '@/features/admin/hooks/useAdminStats';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreatorSidebar } from '@/features/admin/components/CreatorSidebar';
import { useChannelsQuery } from '@/features/feed/hooks/useChannelsQuery';
import { buildCreatorsFromChannels } from '@/features/feed/utils/buildCreators';
import { KpiCard } from '@/features/admin/components/KPICard';
import { PlatformStatsCard } from '@/features/admin/components/PlatformChart';
import { ContentTypeCard } from '@/features/admin/components/ContentTypeChart';
import { ChannelStatsTable } from '@/features/admin/components/ChannelTable';
import { DailyViewsLineChart } from '@/features/admin/components/DailyViewsLineChart';
import { FilterButtonGroup } from '@/features/admin/components/FilterButtonGroup';
import { formatKstDateString } from '@/features/admin/utils';
import AdminDashboardLoading from '@/features/admin/components/AdminDashboardSkeleton';
import {
  DATE_RANGE_META,
  KPI_CARDS,
  DATE_RANGE_OPTIONS,
  PLATFORM_OPTIONS,
  CONTENT_TYPE_OPTIONS,
} from '@/features/admin/constants';
import type { DateRangeType, PlatformType, ContentType } from '@/features/admin/types';
import type { CreatorSidebarItem } from '@/features/creator/types';

export default function AdminDashboard() {
  const [platform, setPlatform] = useState<PlatformType>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('last_7_days');
  const [contentType, setContentType] = useState<ContentType>('all');

  const { data: channels = [] } = useChannelsQuery();
  const creators = useMemo(() => buildCreatorsFromChannels(channels), [channels]);
  const [selectedCreator, setSelectedCreator] = useState<CreatorSidebarItem | null>(null);

  const selectedChannelIds = selectedCreator?.channelIds ?? [];

  const { data, isFetching, isError } = useAdminStats({
    platform,
    dateRange,
    channelIds: selectedChannelIds,
    contentType,
  });

  const refreshStats = useRefreshAdminStats({
    platform,
    dateRange,
    channelIds: selectedChannelIds,
    contentType,
  });

  const prefetchIfNeeded = usePrefetchIfNeeded({
    platform,
    dateRange,
    contentType,
    channelIds: selectedChannelIds,
  });

  if (!data) return <AdminDashboardLoading />;
  if (isError) return <div>에러 발생</div>;
  return (
    <div className="flex h-svh min-h-0 w-full overflow-hidden">
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex gap-6 p-8">
          <CreatorSidebar
            creators={creators}
            selectedCreatorId={selectedCreator?.creatorId ?? null}
            onSelectCreator={setSelectedCreator}
            platform={platform}
            dateRange={dateRange}
            contentType={contentType}
          />

          <div className="relative min-w-0 flex-1">
            {isFetching && (
              <div className="bg-background/60 absolute inset-0 z-9999 flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-muted-foreground text-sm">데이터 업데이트 중…</span>
              </div>
            )}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">관리자 대시보드</h1>
                <p className="text-muted-foreground text-sm">
                  {DATE_RANGE_META[dateRange].label} ({formatKstDateString(data.dateRange.current.start)} ~{' '}
                  {formatKstDateString(data.dateRange.current.end)} · KST) · 총 {data.kpi.totalChannels}개 채널
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshStats} disabled={isFetching} className="gap-2">
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                새로고침
              </Button>
            </div>
            <div className="bg-background/80 sticky top-[env(safe-area-inset-top)] z-50 mb-4 flex flex-wrap gap-4 rounded-lg border border-b p-6 backdrop-blur-sm">
              <FilterButtonGroup
                title="기간"
                options={DATE_RANGE_OPTIONS}
                value={dateRange}
                onChange={(v) => setDateRange(v as DateRangeType)}
                onHover={(v) => prefetchIfNeeded({ dateRange: v as DateRangeType })}
              />
              <FilterButtonGroup
                title="플랫폼"
                options={PLATFORM_OPTIONS}
                value={platform}
                onChange={(v) => setPlatform(v as PlatformType)}
                onHover={(v) => prefetchIfNeeded({ platform: v as PlatformType })}
              />
              <FilterButtonGroup
                title="콘텐츠 타입"
                options={CONTENT_TYPE_OPTIONS}
                value={contentType}
                onChange={(v) => setContentType(v as ContentType)}
                onHover={(v) => prefetchIfNeeded({ contentType: v as ContentType })}
              />
            </div>
            <div className={cn(isFetching && 'pointer-events-none')}>
              {/* KPI 카드 */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {KPI_CARDS.map((config) => (
                  <KpiCard
                    key={config.key}
                    title={config.title}
                    value={data.kpi[config.key]}
                    change={data.kpi[config.changeKey]}
                    description={DATE_RANGE_META[dateRange].compareLabel}
                  />
                ))}
              </div>

              {/* 차트 영역 */}
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <PlatformStatsCard data={data.platformStats} />
                <ContentTypeCard data={data.contentTypeDistribution} />
              </div>

              <ChannelStatsTable data={data.channelStats} />
              <DailyViewsLineChart data={data.dailyViews || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
