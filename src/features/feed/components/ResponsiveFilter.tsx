'use client';

import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import ContentTypeFilter from '@/features/feed/components/ContentTypeFilter';
import SortFilter from '@/features/feed/components/SortFilter';
import { Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type ContentFilterType = 'all' | 'video' | 'short' | 'live' | 'vod';
type SortFilterType = 'published' | 'views_day' | 'views_week';
type PlatformType = 'all' | 'youtube' | 'chzzk';
export default function ResponsiveFilter({
  sortFilter,
  onSortFilterChange,
  videoType,
  onVideoTypeChange,
  platform,
}: {
  sortFilter: SortFilterType;
  onSortFilterChange: (v: SortFilterType) => void;
  videoType: ContentFilterType;
  onVideoTypeChange: (v: ContentFilterType) => void;
  platform: PlatformType;
}) {
  const isMobile = useIsMobile();
  const [tempSortFilter, setTempSortFilter] = useState(sortFilter);
  const [tempVideoType, setTempVideoType] = useState(videoType);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleDrawerOpen = () => {
    setTempSortFilter(sortFilter);
    setTempVideoType(videoType);
    setIsDrawerOpen(true);
  };
  const applyFilters = () => {
    onSortFilterChange(tempSortFilter);
    onVideoTypeChange(tempVideoType);
    setIsDrawerOpen(false);
  };
  const resetFilters = () => {
    setTempSortFilter('published');
    setTempVideoType('all');
  };
  const getActiveFiltersCount = () => {
    let count = 0;
    if (sortFilter !== 'published') count += 1;
    if (videoType !== 'all') count += 1;
    return count;
  };
  return (
    <div className="flex items-center justify-between">
      {isMobile ? (
        /* Mobile: 현재 필터 상태만 표시 */
        <div className="w-full flex flex-col items-center gap-2">
          <div className="ml-4">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="default" size="sm" className="relative gap-2" onClick={handleDrawerOpen}>
                  <Filter className="w-4 h-4" />
                  필터
                  {getActiveFiltersCount() > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                    >
                      {getActiveFiltersCount()}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>

              <DrawerContent className="max-h-[85vh]">
                <DrawerHeader>
                  <DrawerTitle>정렬 & 필터</DrawerTitle>
                  <DrawerDescription>원하는 정렬 방식과 콘텐츠 타입을 선택하세요.</DrawerDescription>
                </DrawerHeader>

                <div className="px-4 py-6 space-y-6 overflow-y-auto flex-1">
                  <div>
                    <h3 className="text-base font-medium mb-4">정렬 방식</h3>
                    <SortFilter value={tempSortFilter} onChange={setTempSortFilter} />
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-base font-medium mb-4">콘텐츠 타입</h3>
                    <div className="space-y-2">
                      <ContentTypeFilter
                        value={tempVideoType}
                        onChange={setTempVideoType}
                        platform={platform}
                        isMobile
                      />
                    </div>
                  </div>
                </div>

                <DrawerFooter className="pt-4 mb-6">
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={resetFilters}>
                      초기화
                    </Button>
                    <DrawerClose asChild>
                      <Button className="flex-1" onClick={applyFilters}>
                        적용하기
                      </Button>
                    </DrawerClose>
                  </div>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
          {/* <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{sortOptions.find((o) => o.id === sortFilter)?.label}</Badge>
              <Badge variant="secondary">{contentTypes.find((t) => t.id === tempVideoType)?.label}</Badge>
            </div> */}
        </div>
      ) : (
        /* Desktop: 정렬 & 필터 컴포넌트 모두 표시 */
        <div className="flex flex-wrap items-center gap-4">
          <SortFilter value={sortFilter} onChange={onSortFilterChange} />

          <>
            <Separator orientation="vertical" className="h-6" />
            <ContentTypeFilter value={videoType} onChange={onVideoTypeChange} platform={platform} />
          </>
        </div>
      )}
    </div>
  );
}
