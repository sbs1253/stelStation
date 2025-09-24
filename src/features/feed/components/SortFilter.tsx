'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { SortType } from '@/features/feed/types';
import { Calendar, Clock, TrendingUp } from 'lucide-react';

const SORT_OPTIONS = [
  { id: 'published', label: '최신순', icon: Clock },
  { id: 'views_day', label: '일간인기순', icon: TrendingUp },
  { id: 'views_week', label: '주간인기순', icon: Calendar },
] as const;

export default function SortFilter({
  value,
  onChange,
  disabled,
}: {
  value: SortType;
  onChange: (v: SortType) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as SortType)}
        className="flex flex-wrap gap-3"
      >
        {SORT_OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.id}
            value={opt.id}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all duration-200 shadow-sm data-[state=on]:bg-gray-900 data-[state=on]:text-white data-[state=on]:shadow-lg"
          >
            <opt.icon className={`h-4 w-4 ${value !== opt.id ? 'text-muted-foreground' : ''}`} />
            <span>{opt.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
