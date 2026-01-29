'use client';

import Image from 'next/image';
import { House } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';

import type { CreatorSidebarItem } from '@/features/creator/types';
import type { PlatformType, DateRangeType, ContentType } from '@/features/admin/types';
import { usePrefetchAdminStats, adminStatsKey } from '@/features/admin/hooks/useAdminStats';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  creators: CreatorSidebarItem[];
  selectedCreatorId: string | null;
  onSelectCreator: (creator: CreatorSidebarItem | null) => void;
  platform: PlatformType;
  dateRange: DateRangeType;
  contentType: ContentType;
};

export function CreatorSidebar({
  creators,
  selectedCreatorId,
  onSelectCreator,
  platform,
  dateRange,
  contentType,
}: Props) {
  const prefetchAdminStats = usePrefetchAdminStats();
  const queryClient = useQueryClient();

  const prefetchIfNeeded = (channelIds: string[]) => {
    const filters = { platform, dateRange, contentType, channelIds };
    const key = adminStatsKey(filters);

    // ✅ 이미 캐시가 있거나, 요청 중이면 중복 prefetch 방지
    const state = queryClient.getQueryState(key);
    if (state?.fetchStatus === 'fetching') return;
    if (state?.data) return;

    prefetchAdminStats(filters);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarMenu className="mt-4 gap-2">
          {/* 전체 크리에이터 */}
          <SidebarMenuItem className="pl-2">
            <SidebarMenuButton
              onClick={() => onSelectCreator(null)}
              isActive={selectedCreatorId === null}
              onMouseEnter={() => prefetchIfNeeded([])}
            >
              <House className="size-4" />
              <span className="truncate font-bold group-data-[collapsible=icon]:hidden">전체 크리에이터</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 크리에이터 목록 */}
          {creators.map((creator) => {
            const isActive = selectedCreatorId === creator.creatorId;

            return (
              <SidebarMenuItem key={creator.creatorId}>
                <SidebarMenuButton
                  onMouseEnter={() => prefetchIfNeeded(creator.channelIds)}
                  onFocus={() => prefetchIfNeeded(creator.channelIds)}
                  onClick={() => onSelectCreator(creator)}
                  isActive={isActive}
                  className={cn('h-auto transition-all', isActive && 'border shadow-sm')}
                >
                  <Avatar className="size-10 flex-shrink-0 overflow-hidden">
                    {creator.thumb ? (
                      <Image src={creator.thumb} alt={creator.name} width={40} height={40} className="object-cover" />
                    ) : (
                      <AvatarFallback>{creator.name?.charAt(0)}</AvatarFallback>
                    )}
                  </Avatar>

                  <div className="ml-2 min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <div className="truncate font-semibold">{creator.name}</div>

                    <div className="mt-1 flex items-center gap-1.5 opacity-80">
                      {creator.platforms['youtube'] && <Image src={youtube_icon} alt="유튜브" width={20} height={20} />}
                      {creator.platforms['chzzk'] && <Image src={chzzk_icon} alt="치지직" width={14} height={14} />}
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
