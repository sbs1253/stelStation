import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PlatformStat } from '@/features/admin/types';

export function PlatformStatsCard({ data }: { data: PlatformStat[] }) {
  const total = data.reduce((sum, s) => sum + s.views, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>플랫폼별 조회수</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((stat) => {
          const percentage = total > 0 ? (stat.views / total) * 100 : 0;
          const platformName = stat.platform === 'youtube' ? 'Youtube' : 'Chzzk';

          return (
            <div key={stat.platform} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{platformName}</span>
                <span className="text-xs font-bold">{(stat.views / 1000000).toFixed(1)}M</span>
              </div>

              {/* 프로그레스 바 */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={cn(
                    'absolute h-full rounded-full transition-all',
                    stat.platform === 'youtube' ? 'bg-black' : 'bg-gray-800',
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="text-muted-foreground text-xs">
                {stat.videos}개 영상 · 평균 {(stat.avgViews / 1000).toFixed(1)}K 조회수
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
