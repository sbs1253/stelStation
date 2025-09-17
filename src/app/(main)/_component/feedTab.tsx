'use client';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import Image from 'next/image';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function FeedTab({
  value,
  onChange,
}: {
  value: 'all' | 'youtube' | 'chzzk';
  onChange: (v: 'all' | 'youtube' | 'chzzk') => void;
}) {
  const platformOptions = [
    { id: 'all', label: 'All', icon: null },
    {
      id: 'youtube',
      label: 'YouTube',
      icon: <Image src={youtube_icon} alt="YouTube logo" width={30} height={30} className="object-contain" />,
    },
    {
      id: 'chzzk',
      label: 'Chzzk',
      icon: <Image src={chzzk_icon} alt="Chzzk logo" width={20} height={20} className="object-contain" />,
    },
  ];

  return (
    <div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as 'all' | 'youtube' | 'chzzk');
        }}
        className="flex flex-wrap gap-3"
      >
        {platformOptions.map((option) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className="flex flex-shrink-0 items-center justify-center gap-2 px-4 py-2 min-w-[120px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md border"
          >
            {option.icon ?? null}
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
