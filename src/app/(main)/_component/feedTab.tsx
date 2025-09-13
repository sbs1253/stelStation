'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import chzzk_logo from '@/assets/icons/chzzk_logo.png';
import youtube_logo from '@/assets/icons/youtube_logo.png';
import Image from 'next/image';
export default function FeedTab({
  value,
  onChange,
}: {
  value: 'all' | 'youtube' | 'chzzk';
  onChange: (v: 'all' | 'youtube' | 'chzzk') => void;
}) {
  const tabs = [
    { label: 'All', value: 'all', content: <span>All</span> },
    {
      label: 'YouTube',
      value: 'youtube',
      content: <Image src={youtube_logo} alt="YouTube logo" width={50} height={20} className="w-full" />,
    },
    {
      label: 'Chzzk',
      value: 'chzzk',
      content: <Image src={chzzk_logo} alt="Chzzk logo" width={50} height={20} className="w-full" />,
    },
  ];

  return (
    <Tabs value={value} className="" onValueChange={(v) => onChange(v as 'all' | 'youtube' | 'chzzk')}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {/* {t.label} */}
            {t.content}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
