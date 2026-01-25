import { Card } from '@/components/ui/card';
import type { PlatformStats } from '../types';

type PlatformChartProps = {
  data: PlatformStats[];
  totalViews: number;
  isLoading?: boolean;
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function PlatformChart({ data, totalViews, isLoading }: PlatformChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">플랫폼별 조회수</h3>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3" />
              <div className="h-2 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">플랫폼별 조회수</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.platform} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium capitalize">{item.platform}</span>
              <span className="text-gray-600">{formatNumber(item.views)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${totalViews > 0 ? (item.views / totalViews) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {item.videos}개 영상 · 평균 {formatNumber(item.avgViews)} 조회수
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
