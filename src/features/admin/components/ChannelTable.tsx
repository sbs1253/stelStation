'use client';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ChannelStat, SortKey, SortOrder } from '@/features/admin/types';

type ChannelStatsTableProps = {
  data: ChannelStat[];
  onSelectChannel?: (channelId: string) => void;
};

export function ChannelStatsTable({ data, onSelectChannel }: ChannelStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalViews');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];
        if (sortOrder === 'asc') return aValue - bValue;
        return bValue - aValue;
      }),
    [data, sortKey, sortOrder],
  );

  function SortableHead({ label, columnKey }: { label: string; columnKey: SortKey }) {
    const isActive = sortKey === columnKey;

    return (
      <TableHead
        onClick={() => {
          if (isActive) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortKey(columnKey);
            setSortOrder('desc');
          }
        }}
        className="cursor-pointer text-right select-none"
      >
        <div className="flex items-center justify-end gap-1">
          {label}
          {isActive && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </div>
      </TableHead>
    );
  }

  return (
    <div className="mt-6 rounded-md border">
      <div className="p-4">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>채널</TableHead>
                <TableHead>플랫폼</TableHead>
                <SortableHead label="총 조회수" columnKey="totalViews" />
                <SortableHead label="영상당 평균 조회수" columnKey="avgViews" />
                <SortableHead label="영상 수" columnKey="totalVideos" />
                <SortableHead label="조회수 증감" columnKey="viewsChange" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((channel) => {
                const isPositive = channel.viewsChange >= 0;

                return (
                  <TableRow
                    key={channel.channelId}
                    onClick={() => onSelectChannel?.(channel.channelId)}
                    className="hover:bg-muted/50 cursor-pointer"
                  >
                    <TableCell className="max-w-[220px] truncate font-medium">{channel.channelName}</TableCell>
                    <TableCell className="capitalize">{channel.platform}</TableCell>
                    <TableCell className="text-right">{channel.totalViews.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{channel.avgViews.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{channel.totalVideos}</TableCell>
                    <TableCell className={cn('text-right font-medium', isPositive ? 'text-red-600' : 'text-blue-600')}>
                      {isPositive ? '+' : ''}
                      {channel.viewsChange.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
