import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PlatformStats, ContentTypeDistribution } from '@/features/admin/types';

// 프로페셔널 색상 팔레트 (서브틀)
const COLORS = {
  primary: '#18181b',
  secondary: '#71717a',
  accent: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  youtube: '#ff0000',
  chzzk: '#00e5a0',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// ============================================================
// KPI 카드 - Professional Minimal Design
// ============================================================

type ProKPICardProps = {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
};

export function ProKPICard({ title, value, change, icon: Icon, isLoading }: ProKPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0;

  return (
    <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {isLoading ? (
              <div className="h-9 w-28 bg-gray-100 animate-pulse rounded mt-2" />
            ) : (
              <p className="text-3xl font-semibold text-gray-900 mt-2 tracking-tight">{value}</p>
            )}
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <Icon className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        {!isLoading && change !== undefined && (
          <div className="flex items-center gap-1 mt-4">
            {isPositive && <TrendingUp className="w-4 h-4 text-green-600" />}
            {isNegative && <TrendingDown className="w-4 h-4 text-red-600" />}
            {isNeutral && <Minus className="w-4 h-4 text-gray-400" />}
            <span
              className={`text-sm font-medium ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {change.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs 이전 기간</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// 플랫폼별 통계 카드 - Interactive
// ============================================================

type ProPlatformStatsProps = {
  data: PlatformStats[];
  onPlatformClick?: (platform: 'youtube' | 'chzzk') => void;
  isLoading?: boolean;
};

export function ProPlatformStats({ data, onPlatformClick, isLoading }: ProPlatformStatsProps) {
  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <div className="p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">플랫폼별 성과</h3>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.views, 0);

  return (
    <Card className="border border-gray-200">
      <div className="p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">플랫폼별 성과</h3>
        <div className="space-y-5">
          {data.map((item) => {
            const percentage = total > 0 ? (item.views / total) * 100 : 0;
            const isYoutube = item.platform === 'youtube';

            return (
              <div
                key={item.platform}
                onClick={() => onPlatformClick?.(item.platform)}
                className="group cursor-pointer"
              >
                {/* 플랫폼 헤더 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isYoutube ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="text-sm font-medium text-gray-900 capitalize">{item.platform}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatNumber(item.views)}</span>
                </div>

                {/* 프로그레스 바 */}
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      isYoutube ? 'bg-red-500' : 'bg-emerald-500'
                    } group-hover:opacity-80`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* 메타 정보 */}
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{item.videos}개 영상</span>
                  <span>평균 {formatNumber(item.avgViews)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// 콘텐츠 타입별 통계 - Grid Cards
// ============================================================

type ProContentTypeStatsProps = {
  data: ContentTypeDistribution[];
  onTypeClick?: (type: 'video' | 'short' | 'vod') => void;
  isLoading?: boolean;
};

export function ProContentTypeStats({ data, onTypeClick, isLoading }: ProContentTypeStatsProps) {
  const getTypeInfo = (type: string) => {
    const configs = {
      video: { label: '영상', color: 'bg-blue-500', icon: '🎬' },
      short: { label: '쇼츠', color: 'bg-orange-500', icon: '⚡' },
      vod: { label: 'VOD', color: 'bg-purple-500', icon: '📺' },
    };
    return configs[type as keyof typeof configs] || configs.video;
  };

  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <div className="p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">콘텐츠 유형</h3>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <div className="p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">콘텐츠 유형</h3>
        <div className="grid grid-cols-3 gap-4">
          {data.map((item) => {
            const info = getTypeInfo(item.type);

            return (
              <div
                key={item.type}
                onClick={() => onTypeClick?.(item.type)}
                className="group relative p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              >
                {/* 아이콘 */}
                <div className="text-2xl mb-2">{info.icon}</div>

                {/* 타입명 */}
                <p className="text-xs font-medium text-gray-600 mb-1">{info.label}</p>

                {/* 카운트 */}
                <p className="text-2xl font-semibold text-gray-900">{item.count}</p>

                {/* 퍼센트 */}
                <div className="flex items-center gap-1 mt-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${info.color}`} />
                  <span className="text-xs text-gray-500">{item.percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Area Chart - 트렌드 미리보기 (향후 확장용)
// ============================================================

type ProTrendPreviewProps = {
  data?: Array<{ date: string; value: number }>;
  title?: string;
  isLoading?: boolean;
};

export function ProTrendPreview({ data = [], title = '최근 7일 트렌드', isLoading }: ProTrendPreviewProps) {
  // 더미 데이터 (실제 구현시 props로 받음)
  const dummyData = [
    { date: '17일', value: 45000 },
    { date: '18일', value: 52000 },
    { date: '19일', value: 48000 },
    { date: '20일', value: 61000 },
    { date: '21일', value: 58000 },
    { date: '22일', value: 63000 },
    { date: '23일', value: 67000 },
  ];

  const chartData = data.length > 0 ? data : dummyData;

  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <div className="p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">{title}</h3>
          <div className="h-[200px] bg-gray-100 animate-pulse rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-500">일일 조회수</span>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number) => [formatNumber(value), '조회수']}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '4px' }}
            />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Export
export {
  ProKPICard as KPICard,
  ProPlatformStats as PlatformChart,
  ProContentTypeStats as ContentTypeChart,
  ProTrendPreview as TrendChart,
};
