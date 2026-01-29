import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContentTypeStat } from '@/features/admin/types';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  video: '영상',
  short: '쇼츠',
  vod: 'VOD',
};

export function ContentTypeCard({ data }: { data: ContentTypeStat[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>콘텐츠 타입별 분포</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((item) => (
          <div key={item.type} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{CONTENT_TYPE_LABELS[item.type]}</span>
              <span className="text-xs font-bold">
                {item.count}개 ({item.percentage}%)
              </span>
            </div>

            {/* 프로그레스 바 */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="absolute h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
