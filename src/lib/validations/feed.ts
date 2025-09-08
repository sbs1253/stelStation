import { z } from 'zod';
import { DEFAULT_LIMIT, MAX_LIMIT } from '@/lib/config/constants';
/** /api/feed 쿼리 스키마 (App Router의 URL → 객체) */
export const FeedQuerySchema = z.object({
  channelIds: z.array(z.string()).optional(), // 게스트용 (로그인 후엔 groupId 사용 예정)
  groupId: z.string().optional(), // 로그인 후 확장 시 사용
  sort: z.enum(['published', 'views_day', 'views_week']).default('published'),
  filterType: z.enum(['all', 'video', 'short', 'live', 'vod']).default('all'),
  range: z.enum(['7', '30', '90', '120']).default('30'), // 현재는 표시 목적, 랭킹 계산엔 영향 없음
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().optional(),
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

  let rawIds: string[] = [];
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

  const obj = {
    channelIds,
    groupId: sp.get('groupId') || undefined,
    sort: (sp.get('sort') as any) || undefined,
    filterType: ((sp.get('filterType') || sp.get('filter.type')) as any) || undefined,
    range: (sp.get('range') as any) || undefined,
    limit: sp.get('limit') || undefined,
    cursor: sp.get('cursor') || undefined,
  };

  return FeedQuerySchema.parse(obj);
}
