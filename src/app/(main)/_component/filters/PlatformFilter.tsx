'use client';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import Image from 'next/image';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';

type Platform = 'all' | 'youtube' | 'chzzk';

const PLATFORM_OPTIONS: Array<{ id: Platform; label: string; icon?: React.ReactNode }> = [
  { id: 'all', label: 'All' },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: <Image src={youtube_icon} alt="YouTube" width={22} height={22} className="object-contain " />,
  },
  {
    id: 'chzzk',
    label: 'Chzzk',
    icon: <Image src={chzzk_icon} alt="Chzzk" width={18} height={18} className="object-contain" />,
  },
];

export default function PlatformFilter({ value, onChange }: { value: Platform; onChange: (v: Platform) => void }) {
  const isMobile = useIsMobile();
  return (
    <div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as Platform);
        }}
        className="flex flex-wrap gap-3"
      >
        {PLATFORM_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className={`flex flex-1 flex-shrink-0 items-center justify-center gap-2 ${
              isMobile ? 'px-2 py-1 min-w-[80px]' : 'px-4 py-2 min-w-[120px]'
            } data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md border   basis-auto w-fit`}
          >
            {option.icon ?? null}
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
