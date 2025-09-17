'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Play, Film, Tv, Camera } from 'lucide-react';
export type ContentFilterType = 'all' | 'video' | 'short' | 'live' | 'vod';

export default function ContentTypeFilter({
  value,
  onChange,
}: {
  value: ContentFilterType;
  onChange: (v: ContentFilterType) => void;
}) {
  const videoTypes: Array<{ label: string; value: ContentFilterType; icon: React.ElementType }> = [
    { label: '전체', value: 'all', icon: Play },
    { label: '비디오', value: 'video', icon: Film },
    { label: '쇼츠', value: 'short', icon: Camera },
    { label: '라이브', value: 'live', icon: Tv },
    { label: 'VOD', value: 'vod', icon: Film },
  ];

  const selectedVideoType = videoTypes.find((type) => type.value === value);
  const SelectedVideoTypeIcon = selectedVideoType?.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium shadow-sm">
          {SelectedVideoTypeIcon && <SelectedVideoTypeIcon className="w-4 h-4" />}
          {selectedVideoType?.label}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(value) => {
            if (value) onChange(value as ContentFilterType);
          }}
        >
          {videoTypes.map((type) => {
            const Icon = type.icon;
            return (
              <DropdownMenuRadioItem key={type.value} value={type.value} className="gap-2">
                <Icon className="w-4 h-4" />
                <span>{type.label}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
