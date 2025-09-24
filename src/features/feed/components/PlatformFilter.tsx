'use client';

import Image from 'next/image';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import type { PlatformType } from '@/features/feed/types';

const PLATFORM_OPTIONS: Array<{ id: PlatformType; label: string; icon?: React.ReactNode }> = [
  { id: 'all', label: 'All' },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: <Image src={youtube_icon} alt="YouTube" width={22} height={22} className="object-contain" />,
  },
  {
    id: 'chzzk',
    label: 'Chzzk',
    icon: <Image src={chzzk_icon} alt="Chzzk" width={18} height={18} className="object-contain" />,
  },
];

type Props = {
  value: PlatformType;
  onChange: (v: PlatformType) => void;
  disabled?: boolean;
};

export default function PlatformFilter({ value, onChange, disabled }: Props) {
  return (
    <div aria-label="플랫폼 선택">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as PlatformType)}
        className="flex flex-wrap gap-3"
      >
        {PLATFORM_OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.id}
            value={opt.id}
            disabled={disabled}
            className="
              inline-flex items-center justify-center gap-2
              rounded-md border shadow-sm
              px-3 py-1.5 min-w-[80px]
              sm:px-4 sm:py-2 sm:min-w-[120px]
              data-[state=on]:bg-primary data-[state=on]:text-primary-foreground 
            "
          >
            {opt.icon ?? null}
            <span className="text-sm sm:text-base">{opt.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
