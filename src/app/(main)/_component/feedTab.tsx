'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FeedTab({
  value,
  onChange,
}: {
  value: 'all' | 'youtube' | 'chzzk';
  onChange: (v: 'all' | 'youtube' | 'chzzk') => void;
}) {
  const tabs: Array<{ label: string; value: 'all' | 'youtube' | 'chzzk' }> = [
    { label: 'All', value: 'all' },
    { label: 'YouTube', value: 'youtube' },
    { label: 'Chzzk', value: 'chzzk' },
  ];

  return (
    <Tabs value={value} className="w-[400px]" onValueChange={(v) => onChange(v as 'all' | 'youtube' | 'chzzk')}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
