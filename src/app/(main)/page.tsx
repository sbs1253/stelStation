import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import Ui from './ui';
import { headers } from 'next/headers';
import { feedKeys } from '@/features/feed/utils/feedKeys';
import { getFeedPageSize } from '@/features/feed/utils/pageSize';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';

export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const incoming = new URLSearchParams();
  Object.entries(sp).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => incoming.append(key, v));
    } else if (typeof value === 'string') {
      incoming.append(key, value);
    }
  });
  const normalizedUrl = new URL(`/api/feed?${incoming.toString()}`, base);
  const parsed = parseFeedQueryFromURL(normalizedUrl);
  const pageSize = getFeedPageSize(parsed.scope);

  const apiUrl = new URL('/api/feed', base);
  apiUrl.searchParams.set('scope', parsed.scope);
  apiUrl.searchParams.set('sort', parsed.sort);
  apiUrl.searchParams.set('platform', parsed.platform);
  apiUrl.searchParams.set('filterType', parsed.filterType);
  apiUrl.searchParams.set('limit', pageSize.toString());
  if (parsed.creatorId) apiUrl.searchParams.set('creatorId', parsed.creatorId);
  if (parsed.channelIds?.length) parsed.channelIds.forEach((id) => apiUrl.searchParams.append('channelIds', id));
  if (parsed.cursor) apiUrl.searchParams.set('cursor', parsed.cursor);

  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: feedKeys.all({
      scope: parsed.scope,
      platform: parsed.platform,
      sort: parsed.sort,
      filterType: parsed.filterType,
      creatorId: parsed.creatorId,
      channelIds: parsed.channelIds ?? null,
    }),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const first = new URL(apiUrl);
      if (pageParam) first.searchParams.set('cursor', pageParam);
      const res = await fetch(first.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      return res.json();
    },
    getNextPageParam: (lastPage: { cursor: string | null; hasMore: boolean }) =>
      lastPage.hasMore && lastPage.cursor ? lastPage.cursor : undefined,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Ui />
    </HydrationBoundary>
  );
}
