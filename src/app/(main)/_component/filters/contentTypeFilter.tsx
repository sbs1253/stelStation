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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ContentFilterType = 'all' | 'video' | 'short' | 'live' | 'vod';
const VIDEO_TYPE: Array<{ label: string; value: ContentFilterType; icon: React.ElementType }> = [
  { label: '전체', value: 'all', icon: Play },
  { label: '동영상', value: 'video', icon: Film },
  { label: '쇼츠', value: 'short', icon: Camera },
  { label: '라이브', value: 'live', icon: Tv },
  { label: '다시보기', value: 'vod', icon: Film },
];

export default function ContentTypeFilter({
  value,
  onChange,
  isMobile,
}: {
  value: ContentFilterType;
  onChange: (v: ContentFilterType) => void;
  isMobile?: boolean;
}) {
  const selectedVideoType = VIDEO_TYPE.find((type) => type.value === value);
  const SelectedVideoTypeIcon = selectedVideoType?.icon;

  if (isMobile) {
    return (
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as ContentFilterType);
        }}
        className="flex flex-wrap gap-3"
      >
        {VIDEO_TYPE.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all duration-200 shadow-sm data-[state=on]:bg-gray-900 data-[state=on]:text-white data-[state=on]:shadow-lg`}
          >
            <option.icon className={`h-4 w-4 ${value !== option.value ? option.icon : ''}`} />
            <span>{option.label}</span>
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
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm rounded-full flex items-center gap-2 px-4 py-2.5 font-medium"
        >
          {SelectedVideoTypeIcon && <SelectedVideoTypeIcon className="w-4 h-4" />}
          {selectedVideoType?.label}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 ">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(value) => {
            if (value) onChange(value as ContentFilterType);
          }}
        >
          {VIDEO_TYPE.map((type) => {
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
