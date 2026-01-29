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
        slug: ch.creatorSlug ?? null,
        gen: ch.creatorGen ?? null,
      };
      map.set(ch.creatorId, e);
    }
    e.channelIds.push(ch.id);
    e.platforms[ch.platform as PlatformType] = ch.url;
    if (ch.isLiveNow) e.isLiveNow = true;
    if (!e.x && ch.creatorX) {
      e.x = ch.creatorX;
    }
    if (!e.gen && ch.creatorGen) {
      e.gen = ch.creatorGen;
    }

    if (ch.platform === 'chzzk') {
      e.thumb = ch.thumb ?? e.thumb;
      e.name = ch.title ?? e.name;
    }
    if (!e.slug && ch.creatorSlug) {
      e.slug = ch.creatorSlug;
    }
  }

  // 정렬: 기수 없음(null) → 1기 → 2기 → 3기, 같은 기수 내에서 이름순
  return Array.from(map.values()).sort((a, b) => {
    // 기수 정렬 (null은 0으로 처리해서 맨 앞)
    const genA = a.gen ?? 0;
    const genB = b.gen ?? 0;
    if (genA !== genB) return genA - genB;
    // 같은 기수면 이름순
    return a.name.localeCompare(b.name, 'ko');
  });
}
