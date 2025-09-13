'use client';

import FeedTab from '@/app/(main)/_component/feedTab';
import Filter from '@/app/(main)/_component/filter';
import SideBar from '@/app/(main)/_component/sideBar';
import { formatKSTDate } from '@/lib/time/kst';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDuration } from '@/lib/time/duration';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
  // initialFilterType: 'all' | 'video' | 'short' | 'live' | 'vod';
  initialPlatform: 'all' | 'youtube' | 'chzzk';
};

export default function Ui({
  initialItems,
  initialHasMore,
  initialCursor,
  initialSort,
  // initialFilterType,
  initialPlatform,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'chzzk'>(initialPlatform);
  const [sort, setSort] = useState<'published' | 'views_day' | 'views_week'>(initialSort);
  // const [filterType, setFilterType] = useState<'all' | 'video' | 'short' | 'live' | 'vod'>(initialFilterType);
  // const [cursor, setCursor] = useState<string | null>(initialCursor);
  // const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  // const [select, setSelect] = useState<string>('all');

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // URL → 탭 상태 동기화 (초기 렌더링 및 URL 변경시)
  useEffect(() => {
    const urlPlatform = (searchParams.get('platform') ?? 'all') as 'all' | 'youtube' | 'chzzk';
    const urlSort = (searchParams.get('sort') ?? 'published') as 'published' | 'views_day' | 'views_week';
    console.log(urlSort);
    if (urlSort !== sort) {
      setSort(urlSort);
    }
    if (urlPlatform !== platform) {
      setPlatform(urlPlatform);
    }
  }, [searchParams]);

  // 탭 상태 → URL 동기화 (변경시에만, 히스토리 누적 없이 교체)
  useEffect(() => {
    const currentInUrl = (searchParams.get('platform') ?? 'all') as 'all' | 'youtube' | 'chzzk';
    const sortInUrl = (searchParams.get('sort') ?? 'published') as 'published' | 'views_day' | 'views_week';
    console.log(sortInUrl);
    if (currentInUrl === platform && sortInUrl === sort) return;

    const sp = new URLSearchParams(searchParams.toString());
    if (sort === 'published') {
      sp.delete('sort');
    } else {
      sp.set('sort', sort);
    }

    if (platform === 'all') {
      sp.delete('platform');
    } else {
      sp.set('platform', platform);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }, [platform, sort, pathname, router, searchParams]);

  return (
    <div className="flex gap-4">
      <SideBar />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <FeedTab value={platform} onChange={setPlatform} />
          <Filter value={sort} onChange={setSort} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            return (
              <div key={item.videoId} className="flex flex-col overflow-hidden ">
                <div className="relative aspect-video transition cursor-pointer">
                  <Link href={item.url} key={item.videoId} className="inline-block w-full h-full ">
                    <Image
                      src={item.thumb || ''}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 50vw"
                      className="object-cover rounded hover:scale-[1.01] transition"
                    />
                  </Link>

                  {item.platform === 'youtube' ? (
                    <div className="absolute top-0 right-0">
                      <Image src={youtube_icon} alt="유튜브 아이콘" width={32} height={32} />
                    </div>
                  ) : (
                    <div className="absolute top-1 right-1">
                      <Image src={chzzk_icon} alt="치지직 아이콘" width={24} height={24} />
                    </div>
                  )}
                  <span className="absolute bottom-0 right-1 bg-black/50 text-white text-xs px-1 rounded">
                    {item.durationSec !== null && formatDuration(item.durationSec)}
                  </span>
                </div>

                <div className="flex gap-2 pt-3 px-1">
                  <Link href={item.channel.url}>
                    <Avatar className="size-10">
                      <AvatarImage className="object-cover" src={item.channel.thumb || ''} />
                      <AvatarFallback>{item.channel.title}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="relative flex flex-col items-start ">
                    <Link href={item.url}>
                      <h4 className="font-bold">{item.title}</h4>
                    </Link>
                    <Link href={item.channel.url} className="hover:underline">
                      <span className="text-sm text-gray-600">{item.channel.title}</span>
                    </Link>
                    <p className="text-sm text-gray-600">{formatKSTDate(new Date(item.publishedAt || ''))}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
