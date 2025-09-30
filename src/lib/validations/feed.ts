import { z } from 'zod';
import { DEFAULT_LIMIT, MAX_LIMIT } from '@/lib/config/constants';
const FeedQuerySchema = z.object({
  scope: z.enum(['all', 'channels']).default('all'),
  creatorId: z.string().optional(),
  channelIds: z.array(z.string()).optional(),

  platform: z.enum(['all', 'youtube', 'chzzk']).default('all'),
  sort: z.enum(['published', 'views_day', 'views_week']).default('published'),
  filterType: z.enum(['all', 'video', 'short', 'live', 'vod']).default('all'),

  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().nullable().optional(),
});

/** URLSearchParams → FeedQuerySchema 파싱 */
export function parseFeedQueryFromURL(url: URL) {
  const sp = url.searchParams;

  // 1) channelIds 수집
  // - 반복키: ?channelIds=a&channelIds=b
  // - 배열키: ?channelIds[]=a&channelIds[]=b
  // - 콤마:   ?channelIds=a,b
  const idsFromRepeated = sp.getAll('channelIds');
  const idsFromBracket = sp.getAll('channelIds[]');
  const commaJoined = sp.get('channelIds');

  const rawIds: string[] = [];
  if (idsFromRepeated.length) rawIds.push(...idsFromRepeated);
  if (idsFromBracket.length) rawIds.push(...idsFromBracket);
  if (commaJoined && commaJoined.includes(',')) {
    rawIds.push(
      ...commaJoined
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  // 중복 제거
  const uniqueIds = Array.from(new Set(rawIds));
  const channelIds = uniqueIds.length ? uniqueIds : undefined;

  const rawScope = sp.get('scope');
  const normalizedScope = rawScope === 'creator' ? 'channels' : rawScope || undefined;

  const obj = {
    scope: normalizedScope as any,
    creatorId: sp.get('creatorId') ?? undefined,
    channelIds,

    platform: (sp.get('platform') as any) || undefined,
    sort: (sp.get('sort') as any) || undefined,
    filterType: ((sp.get('filterType') || sp.get('filter.type')) as any) || undefined,

    limit: sp.get('limit') || undefined,
    cursor: sp.get('cursor') || undefined,
  };
  const parsed = FeedQuerySchema.parse(obj);
  // scope 안줬지만 channelIds가 있으면 scope=channels로 간주
  if ((!obj.scope || obj.scope === 'all') && parsed.channelIds && parsed.channelIds.length) {
    return { ...parsed, scope: 'channels' as const };
  }

  return parsed;
}
