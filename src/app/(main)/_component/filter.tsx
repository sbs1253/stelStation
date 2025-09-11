'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Filter({
  value,
  onChange,
}: {
  value: 'published' | 'views_day' | 'views_week';
  onChange: (v: 'published' | 'views_day' | 'views_week') => void;
}) {
  const opts: Array<{ label: string; value: 'published' | 'views_day' | 'views_week' }> = [
    { label: '최신순', value: 'published' },
    { label: '일간 인기순', value: 'views_day' },
    { label: '주간 인기순', value: 'views_week' },
  ];

  return (
    <Select value={value} onValueChange={(v) => onChange(v as any)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="정렬" />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
