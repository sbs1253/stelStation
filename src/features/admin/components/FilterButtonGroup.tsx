'use client';

import { cn } from '@/lib/utils';
import type { FilterOption, FilterValue } from '../types';

type FilterButtonGroupProps = {
  title: string;
  options: FilterOption[];
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  onHover?: (value: FilterValue) => void;
};

export function FilterButtonGroup({ title, options, value, onChange, onHover }: FilterButtonGroupProps) {
  return (
    <div className="flex-shrink-0">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            onMouseEnter={() => onHover?.(option.value)}
            onFocus={() => onHover?.(option.value)}
            className={cn(
              'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              value === option.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-input',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
