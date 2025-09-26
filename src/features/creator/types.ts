import type { PlatformType } from '@/features/feed/types';

export type CreatorSidebarItem = {
  creatorId: string;
  name: string;
  thumb: string | null;
  platforms: PlatformType[];
  isLiveNow: boolean;
  channelIds: string[];
};

export type ChannelRow = {
  id: string;
  platform: 'youtube' | 'chzzk';
  title: string;
  thumb: string | null;
  isLiveNow: boolean;
  recentPublishedAt: string | null;
  creatorId: string | null;
};
