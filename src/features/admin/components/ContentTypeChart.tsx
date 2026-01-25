import { Card } from '@/components/ui/card';
import type { ContentTypeDistribution } from '../types';

type ContentTypeChartProps = {
  data: ContentTypeDistribution[];
  isLoading?: boolean;
};

export function ContentTypeChart({ data, isLoading }: ContentTypeChartProps) {
  const getTypeLabel = (type: string) => {
    if (type === 'vod') return 'VOD';
    if (type === 'short') return '쇼츠';
    return '영상';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">콘텐츠 타입별 분포</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">콘텐츠 타입별 분포</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.type} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{getTypeLabel(item.type)}</span>
              <span className="text-gray-600">
                {item.count}개 ({item.percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${item.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
