'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Play, Film, Tv, Camera, Podcast } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { ContentFilterType, PlatformType } from '@/features/feed/types';
import { ALLOWED_CONTENT_BY_PLATFORM } from '@/features/feed/types';

const CONTENT_TYPE_DEFINITIONS = {
  all: { label: '전체', value: 'all', icon: Play },
  video: { label: '동영상', value: 'video', icon: Film },
  short: { label: '쇼츠', value: 'short', icon: Camera },
  vod: { label: '다시보기', value: 'vod', icon: Tv },
  live: { label: '라이브', value: 'live', icon: Podcast },
} as const;

type Props = {
  value: ContentFilterType;
  onChange: (v: ContentFilterType) => void;
  platform: PlatformType;
  isMobile?: boolean;
  disabled?: boolean;
};

export default function ContentTypeFilter({ value, onChange, platform, isMobile, disabled }: Props) {
  const keys = ALLOWED_CONTENT_BY_PLATFORM[platform];
  const options = keys.map((k) => CONTENT_TYPE_DEFINITIONS[k]);
  const selected = options.find((o) => o.value === value);
  const SelectedIcon = selected?.icon;

  if (isMobile) {
    return (
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as ContentFilterType)}
        className="flex flex-wrap gap-3"
      >
        {options.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all duration-200 shadow-sm data-[state=on]:bg-gray-900 data-[state=on]:text-white data-[state=on]:shadow-lg"
          >
            <opt.icon className={`h-4 w-4 ${value !== opt.value ? 'text-muted-foreground' : ''}`} />
            <span>{opt.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm rounded-full flex items-center gap-2 px-4 py-2.5 font-medium"
        >
          {SelectedIcon && <SelectedIcon className="w-4 h-4" />}
          {selected?.label}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => v && onChange(v as ContentFilterType)}>
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} className="gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span>{opt.label}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
