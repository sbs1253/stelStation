import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AdminDashboardLoading() {
  return (
    <div className="flex h-svh min-h-0 w-full overflow-hidden">
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex gap-6 p-8">
          {/* 사이드바 스켈레톤 */}
          <div className="w-[240px] flex-shrink-0 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>

          <div className="min-w-0 flex-1">
            {/* 헤더 스켈레톤 */}
            <div className="mb-6">
              <Skeleton className="mb-2 h-8 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>

            {/* 필터 스켈레톤 */}
            <div className="mb-4 flex flex-wrap gap-4 rounded-lg border p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex gap-2">
                    {Array.from({ length: i === 0 ? 4 : 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-10 w-24 rounded-md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* KPI 카드 스켈레톤 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <CardHeader>
                    <Skeleton className="h-5 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="mb-2 h-8 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 차트 스켈레톤 */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <Skeleton className="mb-4 h-6 w-32" />
                <Skeleton className="h-[200px] w-full" />
              </Card>
              <Card className="p-4">
                <Skeleton className="mb-4 h-6 w-32" />
                <Skeleton className="h-[200px] w-full" />
              </Card>
            </div>

            {/* 테이블 스켈레톤 */}
            <div className="mt-6 rounded-md border p-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
