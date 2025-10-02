import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import Ui from './ui';
import { headers } from 'next/headers';
import { feedKeys } from '@/features/feed/utils/feedKeys';
import { getFeedPageSize } from '@/features/feed/utils/pageSize';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';
import type { Metadata } from 'next';

export const revalidate = 0;

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const title = 'StelStation – 방송 피드';
  const description =
    'StelStation은 스텔라이브 공식 서비스가 아닌 팬이 만든 비공식 통합 플랫폼입니다. 최신 방송과 영상을 한곳에서 확인하세요.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
    },
  };
}

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
