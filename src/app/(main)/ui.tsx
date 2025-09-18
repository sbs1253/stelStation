'use client';

import PlatformFilter from '@/app/(main)/_component/filters/PlatformFilter';
import SideBar from '@/app/(main)/_component/sideBar';
import { formatKSTDate } from '@/lib/time/kst';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDuration } from '@/lib/time/duration';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ContentTypeFilter from '@/app/(main)/_component/filters/contentTypeFilter';
import SortFilter from '@/app/(main)/_component/filters/sortFilter';
import ResponsiveFilter from '@/app/(main)/_component/filters/responsiveFilter';

type FeedItem = {
  videoId: string;
  platform: 'youtube' | 'chzzk';
  channel: {
    id: string;
    platform: 'youtube' | 'chzzk';
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
  contentType: 'video' | 'short' | 'live' | 'vod';
  stats?: {
    views?: number | null;
    likes?: number | null;
  };
  live?: {
    isLiveNow: boolean;
    hadLive24h: boolean;
  };
  url: string;
};

type Props = {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialSort: 'published' | 'views_day' | 'views_week';
  initialFilterType: 'all' | 'video' | 'short' | 'live' | 'vod';
  initialPlatform: 'all' | 'youtube' | 'chzzk';
};

export default function Ui({
  initialItems,
  initialHasMore,
  initialCursor,
  initialSort,
  initialFilterType,
  initialPlatform,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'chzzk'>(initialPlatform);
  const [sort, setSort] = useState<'published' | 'views_day' | 'views_week'>(initialSort);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'short' | 'live' | 'vod'>(initialFilterType);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // 중복 호출 가드 (fetch 중엔 또 부르지 않게)
  const loadingRef = useRef(false);
  // 중복 아이템 가드 (이미 붙인 videoId 재삽입 방지)
  const seenIdsRef = useRef<Set<string>>(new Set(initialItems.map((i) => i.videoId)));

  // 현재 화면 조건(플랫폼|정렬) 키 보관 → 스테일 응답 가드에 사용
  const paramsKeyRef = useRef('');
  useEffect(() => {
    paramsKeyRef.current = `${platform}|${sort}|${filterType}`;
  }, [platform, sort, filterType]);

  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    seenIdsRef.current = new Set(initialItems.map((i) => i.videoId));
    loadingRef.current = false;
  }, [initialItems, initialCursor, initialHasMore]);

  // URL → 탭 상태 동기화 (초기 렌더링 및 URL 변경시)
  useEffect(() => {
    const urlPlatform = (searchParams.get('platform') ?? 'all') as 'all' | 'youtube' | 'chzzk';
    const urlSort = (searchParams.get('sort') ?? 'published') as 'published' | 'views_day' | 'views_week';
    const urlFilter = (searchParams.get('filterType') ?? 'all') as 'all' | 'video' | 'short' | 'live' | 'vod';
    if (urlSort !== sort) {
      setSort(urlSort);
    }
    if (urlFilter !== filterType) {
      setFilterType(urlFilter);
    }
    if (urlPlatform !== platform) {
      setPlatform(urlPlatform);
    }
  }, [searchParams]);

  // 탭 상태 → URL 동기화 (변경시에만, 히스토리 누적 없이 교체)
  useEffect(() => {
    const platformInUrl = (searchParams.get('platform') ?? 'all') as 'all' | 'youtube' | 'chzzk';
    const sortInUrl = (searchParams.get('sort') ?? 'published') as 'published' | 'views_day' | 'views_week';
    const filterInUrl = (searchParams.get('filterType') ?? 'all') as 'all' | 'video' | 'short' | 'live' | 'vod';
    if (platformInUrl === platform && sortInUrl === sort && filterInUrl === filterType) return;
    console.log(filterInUrl);
    const sp = new URLSearchParams(searchParams.toString());
    if (sort === 'published') {
      sp.delete('sort');
    } else {
      sp.set('sort', sort);
    }
    if (filterType === 'all') {
      sp.delete('filterType');
    } else {
      sp.set('filterType', filterType);
    }
    if (platform === 'all') {
      sp.delete('platform');
    } else {
      sp.set('platform', platform);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }, [platform, sort, filterType, pathname, router, searchParams]);

  // async function fetchMore() {
  //   if (loadingRef.current) return;
  //   if (!hasMore || !cursor) return;
  //   loadingRef.current = true;

  //   // 요청 시점의 조건 스냅샷 (플랫폼|정렬)
  //   const requestedKey = paramsKeyRef.current;

  //   try {
  //     const sp = new URLSearchParams(searchParams.toString());
  //     sp.set('cursor', cursor);
  //     const url = `/api/feed?${sp.toString()}`;

  //     const res = await fetch(url, { cache: 'no-store' });
  //     if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  //     const data = await res.json();

  //     // 요청 중에 플랫폼/정렬이 바뀌었으면(=스테일 응답) 폐기
  //     if (paramsKeyRef.current !== requestedKey) return;

  //     // 중복 아이템 제거
  //     const newItems: FeedItem[] = (data.items || []).filter((item: FeedItem) => {
  //       if (seenIdsRef.current.has(item.videoId)) return false;
  //       seenIdsRef.current.add(item.videoId);
  //       return true;
  //     });

  //     setItems((prev) => [...prev, ...newItems]);
  //     setCursor(data.cursor ?? null);
  //     setHasMore(!!data.hasMore);
  //   } catch (e) {
  //     console.error('Feed fetch failed', e);
  //   } finally {
  //     loadingRef.current = false;
  //   }
  // }

  // useEffect(() => {
  //   const el = sentinelRef.current;
  //   if (!el) return;

  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       const ent = entries[0];
  //       if (ent.isIntersecting) fetchMore();
  //     },
  //     {
  //       root: null,
  //       rootMargin: '100px 0px',
  //       threshold: 0,
  //     }
  //   );

  //   observer.observe(el);
  //   return () => observer.disconnect();
  // }, [cursor, hasMore, searchParams]);

  return (
    <div className="flex w-full h-screen">
      <SideBar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 border-b">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <PlatformFilter value={platform} onChange={setPlatform} />
            <div className="flex gap-2">
              <ResponsiveFilter
                sortFilter={sort}
                onSortFilterChange={setSort}
                videoType={filterType}
                onVideoTypeChange={setFilterType}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <VideoCard key={item.videoId} item={item} />
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="h-8 my-8 grid place-items-center text-xs text-gray-500">
              {loadingRef.current ? '불러오는 중…' : '아래로 스크롤하여 더 보기'}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// 1. VideoCard를 별도의 컴포넌트로 분리하여 가독성과 재사용성 향상 -> 추후 파일 분리 예정
function VideoCard({ item }: { item: FeedItem }) {
  return (
    <div className="flex flex-col overflow-hidden">
      <Link href={item.url} className="relative block w-full aspect-video overflow-hidden rounded-md group bg-gray-200">
        {/* <Image
          src={item.thumb || ''}
          alt={item.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 50vw"
          // 👈 group-hover를 사용해 부모 Link에 호버 시 이미지 확대
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        /> */}
        {item.platform === 'youtube' ? (
          <div className="absolute top-2 right-2 group-hover:scale-105">
            <Image src={youtube_icon} alt="유튜브 아이콘" width={24} height={24} />
          </div>
        ) : (
          <div className="absolute top-2 right-2">
            <Image src={chzzk_icon} alt="치지직 아이콘" width={20} height={20} />
          </div>
        )}
        <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
          {item.durationSec !== null && formatDuration(item.durationSec)}
        </span>
      </Link>

      <div className="flex gap-3 pt-3">
        <Link href={item.channel.url}>
          <Avatar className="size-10">
            {/* <AvatarImage className="object-cover" src={item.channel.thumb || ''} /> */}
            <AvatarFallback>{item.channel.title?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col items-start">
          <Link href={item.url}>
            <h4 className="font-bold leading-snug">{item.title}</h4>
          </Link>
          <Link href={item.channel.url} className="hover:underline">
            <span className="text-sm text-gray-600">{item.channel.title}</span>
          </Link>
          <p className="text-sm text-gray-600">{formatKSTDate(new Date(item.publishedAt || ''))}</p>
        </div>
      </div>
    </div>
  );
}
