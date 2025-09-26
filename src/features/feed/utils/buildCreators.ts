import { ChannelRow, CreatorSidebarItem } from '@/features/creator/types';
import { PlatformType } from '@/features/feed/types';

export function buildCreatorsFromChannels(channels: ChannelRow[]): CreatorSidebarItem[] {
  const map = new Map<string, CreatorSidebarItem>();

  for (const ch of channels) {
    if (!ch.creatorId) continue; // 매핑 없는 채널은 사이드바에서 제외(간단 버전)
    let e = map.get(ch.creatorId);
    if (!e) {
      e = {
        creatorId: ch.creatorId,
        name: ch.title, // 초기값: 첫 채널명 (아래에서 chzzk 우선으로 정제)
        thumb: ch.thumb,
        platforms: [],
        isLiveNow: false,
        channelIds: [],
      };
      map.set(ch.creatorId, e);
    }
    e.channelIds.push(ch.id);
    if (!e.platforms.includes(ch.platform)) e.platforms.push(ch.platform as PlatformType);
    if (ch.isLiveNow) e.isLiveNow = true;

    // chzzk를 우선 썸네일/이름 기준으로 삼자
    if (ch.platform === 'chzzk') {
      e.thumb = ch.thumb ?? e.thumb;
      e.name = ch.title ?? e.name;
    }
  }

  // 정렬: 라이브 우선 → recentPublishedAt 최신 → 이름순
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
