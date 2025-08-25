import { z } from 'zod';

/** /api/feed 쿼리 스키마 (App Router의 URL → 객체) */
export const FeedQuerySchema = z.object({
  channelIds: z.array(z.string()).optional(), // 게스트용 (로그인 후엔 groupId 사용 예정)
  groupId: z.string().optional(), // 로그인 후 확장 시 사용
  sort: z.enum(['published', 'views_day', 'views_week']).default('published'),
  filterType: z.enum(['all', 'video', 'short', 'live', 'vod']).default('all'),
  range: z.enum(['7', '30', '90', '120']).default('30'), // 현재는 표시 목적, 랭킹 계산엔 영향 없음
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

/** URLSearchParams → FeedQuerySchema 파싱 */
export function parseFeedQueryFromURL(url: URL) {
  // 다중 파라미터 (?channelIds=a&channelIds=b) 수집
  const channelIds = url.searchParams.getAll('channelIds');

  return FeedQuerySchema.parse({
    channelIds: channelIds.length ? channelIds : undefined,
    groupId: url.searchParams.get('groupId') || undefined,
    sort: (url.searchParams.get('sort') as any) || undefined,
    // 필드명은 filterType 그대로 쓰되, 쿼리 문자열은 'filter.type'도 허용
    filterType: ((url.searchParams.get('filterType') || url.searchParams.get('filter.type')) as any) || undefined,
    range: (url.searchParams.get('range') as any) || undefined,
    limit: url.searchParams.get('limit') || undefined,
    cursor: url.searchParams.get('cursor') || undefined,
  });
}
