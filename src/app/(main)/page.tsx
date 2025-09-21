import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import Ui from './ui';
import { headers } from 'next/headers';

export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const scope = typeof sp.scope === 'string' ? sp.scope : 'all';
  const sort = typeof sp.sort === 'string' ? sp.sort : 'published';
  const platform = typeof sp.platform === 'string' ? sp.platform : 'all';
  const filterType = typeof sp.filterType === 'string' ? sp.filterType : 'all';
  const limit = typeof sp.limit === 'string' ? sp.limit : '24';

  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const url = new URL('/api/feed', base);
  url.searchParams.set('scope', scope);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', limit);
  url.searchParams.set('platform', platform);
  url.searchParams.set('filterType', filterType);

  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ['feed', { platform, sort, filterType }],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const first = new URL(url);
      console.log(pageParam);
      if (pageParam) first.searchParams.set('cursor', pageParam);
      const res = await fetch(first.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      return res.json();
    },
    getNextPageParam: (lastPage: { cursor: string | null; hasMore: boolean }) =>
      lastPage.hasMore && lastPage.cursor ? lastPage.cursor : undefined,
  });

  const data = queryClient.getQueryData<{ items: any[]; hasMore: boolean; cursor: string | null }>([
    'feed',
    { platform, sort, filterType },
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Ui
        initialItems={data?.items ?? []}
        initialHasMore={!!data?.hasMore}
        initialCursor={data?.cursor ?? null}
        initialSort={sort as 'published' | 'views_day' | 'views_week'}
        initialPlatform={platform as 'all' | 'youtube' | 'chzzk'}
        initialFilterType={filterType as 'all' | 'video' | 'short' | 'live' | 'vod'}
      />
    </HydrationBoundary>
  );
}
