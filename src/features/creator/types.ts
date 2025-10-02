import type { PlatformType } from '@/features/feed/types';

export type CreatorSidebarItem = {
  creatorId: string;
  name: string;
  thumb: string | null;
  platforms: Partial<Record<PlatformType, string>>;
  isLiveNow: boolean;
  channelIds: string[];
  x?: string | null;
  slug?: string | null;
};

export type ChannelRow = {
  id: string;
  platform: 'youtube' | 'chzzk';
  title: string;
  thumb: string | null;
  url: string;
  isLiveNow: boolean;
  recentPublishedAt: string | null;
  creatorId: string | null;
  creatorX?: string | null;
  creatorSlug?: string | null;
};
