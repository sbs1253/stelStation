import { ChannelRow, CreatorSidebarItem } from '@/features/creator/types';
import { PlatformType } from '@/features/feed/types';

export function buildCreatorsFromChannels(channels: ChannelRow[]): CreatorSidebarItem[] {
  const map = new Map<string, CreatorSidebarItem>();
  for (const ch of channels) {
    if (!ch.creatorId) continue; 
    let e = map.get(ch.creatorId);
    if (!e) {
      e = {
        creatorId: ch.creatorId,
        name: ch.title, 
        thumb: ch.thumb,
        platforms: {},
        isLiveNow: false,
        channelIds: [],
        x: ch.creatorX ?? null,
      };
      map.set(ch.creatorId, e);
    }
    e.channelIds.push(ch.id);
    e.platforms[ch.platform as PlatformType] = ch.url;
    if (ch.isLiveNow) e.isLiveNow = true;
    if (!e.x && ch.creatorX) {
      e.x = ch.creatorX;
    }

    if (ch.platform === 'chzzk') {
      e.thumb = ch.thumb ?? e.thumb;
      e.name = ch.title ?? e.name;
    }
  }

  const recentMap: Record<string, string | null> = {};
  for (const ch of channels) {
    if (!ch.creatorId) continue;
    const prev = recentMap[ch.creatorId];
    if (!prev || (ch.recentPublishedAt && ch.recentPublishedAt > (prev ?? ''))) {
      recentMap[ch.creatorId] = ch.recentPublishedAt;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isLiveNow !== b.isLiveNow) return a.isLiveNow ? -1 : 1;
    const ra = recentMap[a.creatorId] ?? '';
    const rb = recentMap[b.creatorId] ?? '';
    if (ra !== rb) return ra > rb ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
}
