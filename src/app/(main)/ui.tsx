'use client';

import PlatformFilter from '@/app/(main)/_component/filters/PlatformFilter';
import SideBar from '@/app/(main)/_component/sideBar';
import { formatKSTFriendlyDate, formatKSTLiveTime } from '@/lib/time/kst';
import Link from 'next/link';
import { useEffect } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDuration } from '@/lib/time/duration';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ResponsiveFilter from '@/app/(main)/_component/filters/responsiveFilter';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

type ContentFilterType = 'all' | 'video' | 'short' | 'live' | 'vod';
type PlatformType = 'all' | 'youtube' | 'chzzk';
type FeedItem = {
  videoId: string;
  platform: PlatformType;
  channel: {
    id: string;
    platform: PlatformType;
    platformChannelId: string;
    title: string;
    thumb: string | null;
    isLiveNow: boolean;
    url: string;
  };
  title: string;
  thumb: string | null;
  publishedAt: string | null;
  durationSec: number | null;
  isLive: boolean;
  contentType: ContentFilterType;
  stats?: { views?: number | null };
  live?: { isLiveNow: boolean; hadLive24h: boolean };
  url: string;
};

export default function Ui({}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const platform = (searchParams.get('platform') ?? 'all') as 'all' | 'youtube' | 'chzzk';
  const sort = (searchParams.get('sort') ?? 'published') as 'published' | 'views_day' | 'views_week';
  const filterTypeRaw = (searchParams.get('filterType') ?? 'all') as 'all' | 'video' | 'short' | 'live' | 'vod';
  const allowedTypes = {
    all: ['all', 'video', 'short', 'vod', 'live'],
    youtube: ['all', 'video', 'short'],
    chzzk: ['all', 'vod', 'live'],
  }[platform] as ContentFilterType[];

  const filterType: ContentFilterType = (
    allowedTypes.includes(filterTypeRaw) ? filterTypeRaw : 'all'
  ) as ContentFilterType;
  const isLiveTab = filterType === 'live';

  const setParam = (key: 'platform' | 'sort' | 'filterType', value: string) => {
    const url = new URLSearchParams(searchParams.toString());
    const isDefault =
      (key === 'platform' && value === 'all') ||
      (key === 'sort' && value === 'published') ||
      (key === 'filterType' && value === 'all');

    if (isDefault) url.delete(key);
    else url.set(key, value);

    const qs = url.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    if (!allowedTypes.includes(filterTypeRaw)) {
      setParam('filterType', 'all');
    }
  }, [platform, filterTypeRaw]);

  const {
    data: items = [],
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', { platform, sort, filterType }],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const sp = new URLSearchParams({
        scope: 'all',
        sort,
        platform,
        filterType,
        limit: '24',
      });
      if (pageParam) sp.set('cursor', pageParam);
      const res = await fetch(`/api/feed?${sp.toString()}`, {
        cache: 'no-store',
        signal,
      });
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      return res.json() as Promise<{ items: FeedItem[]; hasMore: boolean; cursor: string | null }>;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage.cursor ? lastPage.cursor : undefined),
    select: (data) => {
      const seen = new Set<string>();
      const out: FeedItem[] = [];
      for (const p of data.pages) {
        for (const it of p.items ?? []) {
          if (!seen.has(it.videoId)) {
            seen.add(it.videoId);
            out.push(it);
          }
        }
      }
      return out;
    },
    placeholderData: keepPreviousData,

    refetchInterval: isLiveTab ? 30_000 : 5 * 60_000,
    refetchIntervalInBackground: false,
  });

  const { ref: loadMoreRef, inView } = useInView({
    root: null,
    rootMargin: '100px 0px',
    threshold: 0,
    delay: 500,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex w-full h-screen min-h-0">
      <SideBar className="flex-shrink-0" />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 border-b">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <PlatformFilter value={platform} onChange={(v) => setParam('platform', v)} />
            <div className="flex gap-2">
              <ResponsiveFilter
                sortFilter={sort}
                onSortFilterChange={(v) => setParam('sort', v)}
                videoType={filterType}
                onVideoTypeChange={(v) => setParam('filterType', v)}
                platform={platform}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          {status === 'pending' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-md bg-gray-200 animate-pulse" />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 text-sm text-red-600 flex items-center gap-2">
              <span>피드를 불러오지 못했습니다.</span>
              <button
                className="underline hover:no-underline disabled:opacity-50"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? '재시도 중...' : '다시 시도'}
              </button>
            </div>
          )}

          {status === 'success' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                  <VideoCard key={item.videoId} item={item} />
                ))}
              </div>

              {hasNextPage && (
                <div ref={loadMoreRef} className="h-8 my-8 grid place-items-center text-xs text-gray-500">
                  {isFetchingNextPage ? '불러오는 중…' : '아래로 스크롤하여 더 보기'}
                </div>
              )}
            </>
          )}

          {isFetching && status === 'success' && (
            <div className="fixed bottom-3 right-3 text-xs bg-black/60 text-white px-2 py-1 rounded">
              새 데이터 갱신 중…
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
function compact(n?: number | null) {
  if (n == null) return '';
  return new Intl.NumberFormat('ko', { notation: 'compact' }).format(n);
}

function VideoCard({ item }: { item: FeedItem }) {
  const isLive = item.contentType === 'live';

  const getThumbnailUrl = (thumb?: string | null) => {
    if (!thumb) return null;
    return thumb.includes('{type}') ? thumb.replace('{type}', '720') : thumb;
  };

  const thumbnailUrl = getThumbnailUrl(item.thumb);
  const published = item.publishedAt ? new Date(item.publishedAt) : null;

  return (
    <div className="flex flex-col overflow-hidden">
      <Link
        href={item.url}
        target="_blank"
        className="relative block w-full aspect-video overflow-hidden rounded-md group bg-gray-200"
      >
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-gray-500">썸네일 없음</div>
        )}

        {item.platform === 'youtube' ? (
          <div className="absolute top-2 right-2 group-hover:scale-105">
            <Image src={youtube_icon} alt="유튜브 아이콘" width={24} height={24} />
          </div>
        ) : (
          <div className="absolute top-2 right-2">
            <Image src={chzzk_icon} alt="치지직 아이콘" width={20} height={20} />
          </div>
        )}

        {!isLive && item.durationSec != null ? (
          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
            {formatDuration(item.durationSec)}
          </span>
        ) : isLive ? (
          <span
            className="absolute bottom-1 right-1 rounded bg-red-600 px-1 text-xs text-white"
            aria-label="라이브 방송 중"
          >
            LIVE{item.stats?.views ? ` · ${compact(item.stats.views)}` : ''}
          </span>
        ) : null}
      </Link>

      <div className="flex gap-3 pt-3">
        <Link href={item.channel.url} target="_blank">
          <Avatar className={`size-10 ${isLive ? 'border border-red-600' : ''}`}>
            <AvatarImage className="object-cover" src={item.channel.thumb || ''} />
            <AvatarFallback>{item.channel.title?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex flex-col items-start">
          <Link href={item.url} target="_blank">
            <h4 className="font-bold leading-snug line-clamp-2">{item.title}</h4>
          </Link>
          <Link href={item.channel.url} className="hover:underline" target="_blank">
            <span className="text-sm text-gray-600">{item.channel.title}</span>
          </Link>

          <p className="text-sm text-gray-600">
            {isLive
              ? published
                ? `시작: ${formatKSTLiveTime(published)}`
                : '방송 중'
              : published
              ? formatKSTFriendlyDate(published)
              : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
