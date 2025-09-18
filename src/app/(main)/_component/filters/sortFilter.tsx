'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar, Clock, TrendingUp } from 'lucide-react';

type SortFilterType = 'published' | 'views_day' | 'views_week';
const SORT_OPTIONS = [
  { id: 'published', label: '최신순', icon: Clock, color: 'text-blue-500' },
  { id: 'views_day', label: '일간인기순', icon: TrendingUp, color: 'text-red-500' },
  { id: 'views_week', label: '주간인기순', icon: Calendar, color: 'text-purple-500' },
];

export default function SortFilter({
  value,
  onChange,
}: {
  value: SortFilterType;
  onChange: (v: SortFilterType) => void;
}) {
  return (
    <div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as SortFilterType);
        }}
        className="flex flex-wrap gap-3"
      >
        {SORT_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all duration-200 shadow-sm data-[state=on]:bg-gray-900 data-[state=on]:text-white data-[state=on]:shadow-lg`}
          >
            <option.icon className={`h-4 w-4 ${value !== option.id ? option.color : ''}`} />
            <span>{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
