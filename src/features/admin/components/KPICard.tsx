import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ===== KPI 카드 =====
type KpiCardProps = {
  title: string;
  value: string | number;
  change?: number;
  description?: string;
};

export function KpiCard({ title, value, change, description }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0;
  return (
    <Card className="relative min-w-[150px] p-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-bold">{value.toLocaleString()}</div>
        {change !== undefined && (
          <div className={cn('text-sm font-medium', isPositive ? 'text-red-600' : 'text-blue-600')}>
            {description && <span className="text-muted-foreground mr-2">{description}</span>}
            {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
