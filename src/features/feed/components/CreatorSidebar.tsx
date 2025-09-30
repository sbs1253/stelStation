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
import x_logo_black from '@/assets/icons/x-logo-black.png';
import Image from 'next/image';
import { House } from 'lucide-react';
import { RefreshIcon } from '@/features/feed/components/RefreshButton';
import { trackClickOutboundLink, trackRefresh, trackSelectItem } from '@/lib/analytics/events';

export default function CreatorSidebar({ className }: { className?: string }) {
  const { data: channels = [], status, refetch, isRefetching } = useChannelsQuery();
  const creators = useMemo(() => buildCreatorsFromChannels(channels), [channels]);
  const { scope, creatorId, setParams } = useUrlFeedState();
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
        <SidebarMenu className="gap-2 mt-4">
          <SidebarMenuItem className="pl-2">
            <SidebarMenuButton
              onClick={selectAll}
              aria-label="전체 크리에이터"
              className="cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              isActive={scope === 'all'}
            >
              <House className="size-4 flex-shrink-0" />
              <span className="font-bold truncate group-data-[collapsible=icon]:hidden">전체 크리에이터</span>
            </SidebarMenuButton>
            <SidebarMenuAction
              aria-label="채널 목록 새로고침"
              onClick={(e) => {
                e.stopPropagation();
                refetch();
                trackRefresh({ location: 'sidebar' });
              }}
              disabled={isRefetching}
            >
              <RefreshIcon spinning={isRefetching} className="h-3.5 w-3.5" />
            </SidebarMenuAction>
          </SidebarMenuItem>

          {status === 'pending' && (
            <SidebarMenuItem>
              <div className="flex flex-col gap-3 p-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-md bg-muted/40 p-2 animate-pulse group-data-[collapsible=icon]:hidden"
                  >
                    <div className="size-10 rounded-full bg-muted-foreground/30" />
                    <div className="flex-1 h-4 rounded bg-muted-foreground/30" />
                  </div>
                ))}
              </div>
            </SidebarMenuItem>
          )}

          {status === 'error' && (
            <SidebarMenuItem>
              <div className="p-2 text-sm text-red-600 group-data-[collapsible=icon]:hidden">
                채널 목록을 불러오지 못했습니다.
              </div>
            </SidebarMenuItem>
          )}
          {status === 'success' &&
            creators.map((c) => {
              const isActive = scope === 'channels' && creatorId === c.creatorId;
              return (
                <SidebarMenuItem key={c.creatorId}>
                  <SidebarMenuButton
                    onClick={() => {
                      selectCreator(c);
                      trackSelectItem({ item_id: c.creatorId, item_name: c.name, item_list_name: 'sidebar' });
                    }}
                    aria-label={c.name}
                    className={`h-auto group-data-[collapsible=icon]:min-w-10 
                      transition-all duration-200 
                      hover:scale-[1.01] active:scale-[0.99]
                      ${isActive ? 'border shadow-sm' : 'hover:bg-foreground/10'}`}
                    isActive={scope === 'channels' && creatorId === c.creatorId}
                  >
                    <Link
                      href={c.platforms['chzzk'] ?? ''}
                      target="_blank"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackSelectItem({
                          item_id: c.creatorId,
                          item_name: c.name,
                          platform: 'chzzk',
                          item_list_name: 'sidebar_avatar',
                        });
                      }}
                    >
                      <Avatar
                        className={`size-10 group-data-[collapsible=icon]:size-8 flex-shrink-0
                            transition-all duration-200 
                            ${c.isLiveNow ? 'border-2 border-red-600' : ''}
                          `}
                      >
                        <AvatarImage src={c.thumb || ''} asChild={true}>
                          <Image
                            src={c.thumb || ''}
                            alt={`${c.name} 프로필 이미지`}
                            width={50}
                            height={50}
                            className="object-cover"
                          />
                        </AvatarImage>

                        <AvatarFallback>{c.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="ml-2 min-w-0 flex-1 whitespace-nowrap transition-all duration-300 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
                      <div className="flex items-center">
                        <span className="truncate font-semibold">{c.name}</span>
                        {c.isLiveNow && (
                          <span className="ml-1.5 text-xs font-semibold text-red-600 animate-pulse">LIVE</span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 opacity-80">
                        {c.platforms['youtube'] && (
                          <Link
                            href={c.platforms['youtube'] ?? ''}
                            target="_blank"
                            aria-label="YouTube"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackClickOutboundLink({
                                creator_id: c.creatorId,
                                creator_name: c.name,
                                platform: 'youtube',
                                location: 'sidebar',
                              });
                            }}
                            className="transition-transform duration-200 hover:scale-110 active:scale-95"
                          >
                            <Image src={youtube_icon} alt="유튜브" width={24} height={24} />
                          </Link>
                        )}
                        {c.platforms['chzzk'] && (
                          <Link
                            href={c.platforms['chzzk'] ?? ''}
                            target="_blank"
                            aria-label="Chzzk"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackClickOutboundLink({
                                creator_id: c.creatorId,
                                creator_name: c.name,
                                platform: 'chzzk',
                                location: 'sidebar',
                              });
                            }}
                            className="transition-transform duration-200 hover:scale-110 active:scale-95"
                          >
                            <Image src={chzzk_icon} alt="치지직" width={14} height={14} />
                          </Link>
                        )}
                        {c.x && (
                          <Link
                            href={c.x}
                            target="_blank"
                            aria-label="X"
                            onClick={(e) => {
                              e.stopPropagation();
                              trackClickOutboundLink({
                                creator_id: c.creatorId,
                                creator_name: c.name,
                                platform: 'x',
                                location: 'sidebar',
                              });
                            }}
                            className="transition-transform duration-200 hover:scale-110 active:scale-95"
                          >
                            <Image src={x_logo_black} alt="X" width={14} height={14} />
                          </Link>
                        )}
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
