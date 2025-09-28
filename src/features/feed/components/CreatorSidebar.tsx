'use client';
import { useMemo } from 'react';
import { useChannelsQuery } from '@/features/feed/hooks/useChannelsQuery';
import { buildCreatorsFromChannels } from '@/features/feed/utils/buildCreators';
import { useUrlFeedState } from '@/features/feed/hooks/useUrlFeedState';
import type { CreatorSidebarItem } from '@/features/creator/types';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import Image from 'next/image';
import { House } from 'lucide-react';
export default function CreatorSidebar({ className }: { className?: string }) {
  const { data: channels = [], status } = useChannelsQuery();
  const creators = useMemo(() => buildCreatorsFromChannels(channels), [channels]);
  console.log(creators);
  const { setParams } = useUrlFeedState();
  const selectAll = () => {
    setParams({
      platform: 'all',
      creatorId: null,
      channelIds: [],
      scope: 'all',
    });
  };

  const selectCreator = (c: CreatorSidebarItem) => {
    setParams({
      platform: 'all',
      filterType: 'all',
      sort: 'published',
      creatorId: c.creatorId,
      channelIds: c.channelIds,
      scope: 'channels',
    });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton onClick={selectAll} aria-label="전체 크리에이터">
              <House className="size-4" />
              <span className="truncate group-data-[collapsible=icon]:hidden">전체 크리에이터</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {status === 'pending' && (
            <SidebarMenuItem>
              <div className="p-2 text-sm text-muted-foreground">로딩 중…</div>
            </SidebarMenuItem>
          )}

          {status === 'error' && (
            <SidebarMenuItem>
              <div className="p-2 text-sm text-red-600">채널 목록을 불러오지 못했습니다.</div>
            </SidebarMenuItem>
          )}
          {status === 'success' &&
            creators.map((c) => (
              <SidebarMenuItem key={c.creatorId} className="flex place-content-center">
                <SidebarMenuButton onClick={() => selectCreator(c)} aria-label={c.name} size={'lg'}>
                  <Avatar className={`size-8 ${c.isLiveNow ? 'ring-2 ring-red-600' : ''}`}>
                    <AvatarImage className="object-cover" src={c.thumb || ''} />
                    <AvatarFallback>{c.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="ml-2 min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center">
                      <span className="truncate">{c.name}</span>
                      {c.isLiveNow && <span className="text-xs text-red-600">LIVE</span>}
                    </div>

                    {/* 아래줄: 외부 링크들 */}
                    <div className="mt-1 flex items-center gap-1 opacity-80">
                      <Link href={c.platforms['youtube'] ?? ''} target="_blank" aria-label="YouTube">
                        <Image src={youtube_icon} alt="유튜브" width={16} height={16} />
                      </Link>
                      <Link href={c.platforms['chzzk'] ?? ''} target="_blank" aria-label="Chzzk">
                        <Image src={chzzk_icon} alt="치지직" width={14} height={14} />
                      </Link>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
