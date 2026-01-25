import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { PlatformStats, ContentTypeDistribution } from '@/features/admin/types';

// 트렌디한 색상 팔레트
const COLORS = {
  youtube: '#FF0000',
  chzzk: '#00FFA3',
  video: '#8B5CF6',
  short: '#F59E0B',
  vod: '#3B82F6',
  gradient1: 'url(#colorGradient1)',
  gradient2: 'url(#colorGradient2)',
};

// ============================================================
// 플랫폼별 Bar Chart (Modern Design)
// ============================================================

type ModernPlatformChartProps = {
  data: PlatformStats[];
  isLoading?: boolean;
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function ModernPlatformChart({ data, isLoading }: ModernPlatformChartProps) {
  const chartData = data.map((item) => ({
    name: item.platform === 'youtube' ? 'YouTube' : 'Chzzk',
    views: item.views,
    videos: item.videos,
    avgViews: item.avgViews,
  }));

  if (isLoading) {
    return (
      <Card className="p-6 backdrop-blur-sm bg-white/80 border border-gray-200/50 shadow-xl">
        <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          플랫폼별 조회수
        </h3>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse space-y-3 w-full">
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 backdrop-blur-sm bg-white/80 border border-gray-200/50 shadow-xl hover:shadow-2xl transition-all duration-300">
      <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
        플랫폼별 조회수
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <defs>
            <linearGradient id="youtubeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FF0000" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="chzzkGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00FFA3" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#00D98E" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#374151', fontSize: 13, fontWeight: 600 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              padding: '12px',
            }}
            formatter={(value: number, name: string) => [formatNumber(value), '조회수']}
            labelStyle={{ fontWeight: 'bold', color: '#111827' }}
          />
          {chartData.map((entry, index) => (
            <Bar
              key={`bar-${index}`}
              dataKey="views"
              radius={[0, 8, 8, 0]}
              fill={entry.name === 'YouTube' ? 'url(#youtubeGradient)' : 'url(#chzzkGradient)'}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* 하단 통계 */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {chartData.map((item) => (
          <div
            key={item.name}
            className="p-3 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200"
          >
            <p className="text-xs text-gray-600 mb-1">{item.name}</p>
            <p className="text-sm font-semibold text-gray-900">{item.videos}개 영상</p>
            <p className="text-xs text-gray-500">평균 {formatNumber(item.avgViews)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// 콘텐츠 타입별 Pie Chart (Modern Design)
// ============================================================

type ModernContentTypeChartProps = {
  data: ContentTypeDistribution[];
  isLoading?: boolean;
};

export function ModernContentTypeChart({ data, isLoading }: ModernContentTypeChartProps) {
  const chartData = data.map((item) => ({
    name: item.type === 'vod' ? 'VOD' : item.type === 'short' ? '쇼츠' : '영상',
    value: item.count,
    percentage: item.percentage,
    type: item.type,
  }));

  const CHART_COLORS = ['#8B5CF6', '#F59E0B', '#3B82F6'];

  if (isLoading) {
    return (
      <Card className="p-6 backdrop-blur-sm bg-white/80 border border-gray-200/50 shadow-xl">
        <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
          콘텐츠 타입 분포
        </h3>
        <div className="h-64 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 backdrop-blur-sm bg-white/80 border border-gray-200/50 shadow-xl hover:shadow-2xl transition-all duration-300">
      <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
        콘텐츠 타입 분포
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <defs>
            <linearGradient id="videoGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="shortGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={1} />
              <stop offset="100%" stopColor="#FCD34D" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="vodGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name} ${percentage}%`}
            outerRadius={80}
            innerRadius={40}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.type === 'video'
                    ? 'url(#videoGradient)'
                    : entry.type === 'short'
                      ? 'url(#shortGradient)'
                      : 'url(#vodGradient)'
                }
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              padding: '12px',
            }}
            formatter={(value: number, name: string, props: any) => [`${value}개 (${props.payload.percentage}%)`, name]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {chartData.map((item, index) => (
          <div key={item.type} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index] }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
              <p className="text-xs text-gray-500">{item.value}개</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// KPI 카드 업그레이드 (Glassmorphism)
// ============================================================

type ModernKPICardProps = {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  gradient: string;
};

export function ModernKPICard({ title, value, change, icon: Icon, isLoading, gradient }: ModernKPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="relative overflow-hidden backdrop-blur-sm bg-white/80 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
      {/* 배경 그라데이션 */}
      <div className={`absolute inset-0 ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />

      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            {isLoading ? (
              <div className="h-8 w-24 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse rounded mt-2" />
            ) : (
              <h3 className="text-3xl font-bold text-gray-900 mb-2">{value}</h3>
            )}
            {!isLoading && change !== undefined && (
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isPositive
                      ? 'bg-green-100 text-green-700'
                      : isNegative
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className={isNegative ? 'rotate-180 inline-block' : ''}>↑</span>
                  {Math.abs(change).toFixed(1)}%
                </div>
                <span className="text-xs text-gray-500">vs 이전 기간</span>
              </div>
            )}
          </div>
          <div
            className={`p-4 rounded-2xl ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Export all components
export { ModernPlatformChart as PlatformChart, ModernContentTypeChart as ContentTypeChart };
