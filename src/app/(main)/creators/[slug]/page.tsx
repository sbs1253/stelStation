import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Ui from '@/app/(main)/ui';
import { getCreatorBySlug } from '@/services/creators/getCreatorBySlug';
import { feedKeys } from '@/features/feed/utils/feedKeys';
import { getFeedPageSize } from '@/features/feed/utils/pageSize';
import { parseFeedQueryFromURL } from '@/lib/validations/feed';
import { supabaseService } from '@/lib/supabase/service';

export const revalidate = 0;

interface CreatorPageProps {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({ params }: CreatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const creator = await getCreatorBySlug(slug);
  if (!creator) {
    return {
      title: '크리에이터를 찾을 수 없습니다 - StelStation',
      description: '요청한 크리에이터 정보를 찾을 수 없습니다.',
    };
  }

  const title = `${creator.name ?? '크리에이터'} - StelStation`;
  const description = `${creator.name ?? '이 크리에이터'}의 최신 방송과 영상을 StelStation에서 확인하세요.`;

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

export async function generateStaticParams() {
  const { data, error } = await supabaseService.from('creators').select('slug').not('slug', 'is', null);
  if (error || !data) return [];
  return data
    .map((row) => row.slug)
    .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
    .map((slug) => ({ slug }));
}

export default async function CreatorPage({ params, searchParams }: CreatorPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const creator = await getCreatorBySlug(slug);
  if (!creator) {
    notFound();
  }
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const incoming = new URLSearchParams();
  Object.entries(sp).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => incoming.append(key, v));
    } else if (typeof value === 'string') {
      incoming.append(key, value);
    }
  });

  incoming.set('scope', 'channels');
  incoming.set('creatorId', creator.id);

  incoming.delete('channelIds');
  creator.channelIds.forEach((id) => incoming.append('channelIds', id));
  const normalizedUrl = new URL(`/api/feed?${incoming.toString()}`, base);
  const parsed = parseFeedQueryFromURL(normalizedUrl);
  const pageSize = getFeedPageSize(parsed.scope);

  const apiUrl = new URL('/api/feed', base);
  apiUrl.searchParams.set('scope', parsed.scope);
  apiUrl.searchParams.set('sort', parsed.sort);
  apiUrl.searchParams.set('platform', parsed.platform);
  apiUrl.searchParams.set('filterType', parsed.filterType);
  apiUrl.searchParams.set('limit', pageSize.toString());
  apiUrl.searchParams.set('creatorId', creator.id);
  if (parsed.channelIds?.length) {
    parsed.channelIds.forEach((id) => apiUrl.searchParams.append('channelIds', id));
  }

  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: feedKeys.all({
      scope: 'channels',
      platform: parsed.platform,
      sort: parsed.sort,
      filterType: parsed.filterType,
      creatorId: creator.id,
      channelIds: parsed.channelIds ?? creator.channelIds,
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
      <Ui initialState={{ scope: 'channels', creatorId: creator.id, channelIds: creator.channelIds }} />
    </HydrationBoundary>
  );
}
