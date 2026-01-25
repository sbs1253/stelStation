import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChannelStat, SortBy } from '../types';

type ChannelTableProps = {
  data: ChannelStat[];
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  isLoading?: boolean;
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function ChannelTable({ data, sortBy, onSortChange, isLoading }: ChannelTableProps) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">채널별 통계</h3>
        <Tabs value={sortBy} onValueChange={(v) => onSortChange(v as SortBy)}>
          <TabsList>
            <TabsTrigger value="views">조회수순</TabsTrigger>
            <TabsTrigger value="generation">기수별</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-sm">채널명</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">플랫폼</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">기수</th>
                <th className="text-right py-3 px-4 font-semibold text-sm">총 조회수</th>
                <th className="text-right py-3 px-4 font-semibold text-sm">영상 수</th>
                <th className="text-right py-3 px-4 font-semibold text-sm">평균 조회수</th>
                <th className="text-right py-3 px-4 font-semibold text-sm">증감률</th>
              </tr>
            </thead>
            <tbody>
              {data.map((channel) => (
                <tr key={channel.channelId} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{channel.channelName}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100">
                      {channel.platform}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{channel.generation ? `${channel.generation}기` : '-'}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatNumber(channel.totalViews)}</td>
                  <td className="py-3 px-4 text-right">{channel.totalVideos}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(channel.avgViews)}</td>
                  <td
                    className={`py-3 px-4 text-right font-medium ${
                      channel.viewsChange && channel.viewsChange > 0
                        ? 'text-green-600'
                        : channel.viewsChange && channel.viewsChange < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                    }`}
                  >
                    {channel.viewsChange !== undefined ? (
                      <>
                        {channel.viewsChange > 0 ? '+' : ''}
                        {channel.viewsChange.toFixed(1)}%
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
