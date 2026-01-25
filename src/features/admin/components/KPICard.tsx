import { Card } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

type KPICardProps = {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
};

export function KPICard({ title, value, change, icon: Icon, isLoading }: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mt-2" />
          ) : (
            <h3 className="text-2xl font-bold mt-2">{value}</h3>
          )}
          {!isLoading && change !== undefined && (
            <p
              className={`text-xs mt-2 flex items-center gap-1 ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              <TrendingUp className={`w-3 h-3 ${isNegative ? 'rotate-180' : ''}`} />
              {isPositive ? '+' : ''}
              {change.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-full">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
