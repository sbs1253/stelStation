'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import chzzk_logo from '@/assets/icons/chzzk_logo.png';
import youtube_logo from '@/assets/icons/youtube_logo.png';
import { LayoutGrid } from 'lucide-react';
import Image from 'next/image';

const sortOptions = [
  { id: 'all', label: 'All', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'youtube', label: 'YouTube', icon: <Image src={youtube_logo} alt="YouTube logo" width={20} height={20} /> },
  { id: 'chzzk', label: 'Chzzk', icon: <Image src={chzzk_logo} alt="Chzzk logo" width={20} height={20} /> },
];

export default function FeedTab({
  value,
  onChange,
}: {
  value: 'all' | 'youtube' | 'chzzk';
  onChange: (v: 'all' | 'youtube' | 'chzzk') => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as 'all' | 'youtube' | 'chzzk');
      }}
      className="flex flex-wrap gap-3"
    >
      {sortOptions.map((option) => {
        return (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            aria-label={`Toggle ${option.label}`}
            className="w-[180px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-full"
          >
            {option.icon}
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
