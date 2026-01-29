import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import type { DailyView } from '@/features/admin/types';

type DailyViewsLineChartProps = {
  data: DailyView[];
  title?: string;
};

export function DailyViewsLineChart({ data, title = '일간 Δ조회수(증가량)' }: DailyViewsLineChartProps) {
  const averageViews = data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.views, 0) / data.length) : 0;
  // 날짜 포맷: MM-DD (년도 제거)
  const formatDateShort = (date: string) => {
    const [, month, day] = date.split('-');
    return `${month}-${day}`;
  };

  // 차트 최소 너비 계산 (데이터 포인트당 60px, 최소 600px)
  const minWidth = Math.max(data.length * 60, 600);
  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] overflow-hidden p-0">
        <div className="h-full overflow-x-auto overflow-y-hidden px-8">
          <div style={{ minWidth: `${minWidth}px`, height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 10, right: 20 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} interval={0} tickFormatter={formatDateShort} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} width={80} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString()}회`, '조회수']}
                  labelFormatter={(label: string) => `📅 ${label}`}
                />
                <ReferenceLine
                  y={averageViews}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: `일간 평균 ${averageViews.toLocaleString()}`,
                    position: 'insideTopRight',
                    fill: 'var(--muted-foreground)',
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
