'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Eye, Video, Users, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import { KPICard } from '@/features/admin/components/KPICard';
import { PlatformChart } from '@/features/admin/components/PlatformChart';
import { ContentTypeChart } from '@/features/admin/components/ContentTypeChart';
import { ChannelTable } from '@/features/admin/components/ChannelTable';
import type { DateRange, SortBy } from '@/features/admin/types';

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('last_7_days');
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'chzzk'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('views');

  const { data, isLoading, isFetching, refetch } = useAdminStats({
    platform,
    dateRange,
  });

  // 채널 정렬
  const sortedChannels = [...(data?.channelStats || [])].sort((a, b) => {
    if (sortBy === 'views') return b.totalViews - a.totalViews;
    if (sortBy === 'generation') return (a.generation || 999) - (b.generation || 999);
    return a.channelName.localeCompare(b.channelName);
  });

  return (
    <div className="h-svh min-h-0 overflow-x-scroll bg-gray-50 p-8 ">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
            <p className="text-gray-600 mt-2">StelStation 통계 및 분석</p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm" className="gap-2">
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            새로고침
          </Button>
        </div>

        {/* 필터 영역 */}
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">기간</label>
              <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <TabsList>
                  <TabsTrigger value="today_vs_yesterday">오늘 vs 어제</TabsTrigger>
                  <TabsTrigger value="this_week_vs_last_week">이번주 vs 지난주</TabsTrigger>
                  <TabsTrigger value="last_7_days">최근 7일</TabsTrigger>
                  <TabsTrigger value="last_30_days">최근 30일</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">플랫폼</label>
              <Tabs value={platform} onValueChange={(v) => setPlatform(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">전체</TabsTrigger>
                  <TabsTrigger value="youtube">YouTube</TabsTrigger>
                  <TabsTrigger value="chzzk">Chzzk</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </Card>

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="총 조회수"
            value={formatNumber(data?.kpi.totalViews || 0)}
            change={data?.kpi.viewsChange}
            icon={Eye}
            isLoading={isLoading}
          />
          <KPICard
            title="총 영상 수"
            value={data?.kpi.totalVideos || 0}
            change={data?.kpi.videosChange}
            icon={Video}
            isLoading={isLoading}
          />
          <KPICard
            title="총 채널 수"
            value={data?.kpi.totalChannels || 0}
            change={data?.kpi.channelsChange}
            icon={Users}
            isLoading={isLoading}
          />
          <KPICard
            title="평균 조회수"
            value={formatNumber(data?.kpi.avgViews || 0)}
            change={data?.kpi.avgViewsChange}
            icon={TrendingUp}
            isLoading={isLoading}
          />
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PlatformChart
            data={data?.platformStats || []}
            totalViews={data?.kpi.totalViews || 0}
            isLoading={isLoading}
          />
          <ContentTypeChart data={data?.contentTypeDistribution || []} isLoading={isLoading} />
        </div>

        {/* 채널별 상세 테이블 */}
        <ChannelTable data={sortedChannels} sortBy={sortBy} onSortChange={setSortBy} isLoading={isLoading} />
      </div>
    </div>
  );
}
