'use client';

import FeedTab from '@/app/(main)/_component/feedTab';
import Filter from '@/app/(main)/_component/filter';
import SideBar from '@/app/(main)/_component/sideBar';
import { formatKSTDate } from '@/lib/time/kst';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDuration } from '@/lib/time/duration';
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
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'chzzk'>(initialPlatform);
  const [sort, setSort] = useState<'published' | 'views_day' | 'views_week'>(initialSort);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'short' | 'live' | 'vod'>(initialFilterType);

  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [select, setSelect] = useState<string>('all');
  return (
    <div className="flex mx-auto min-w-svw gap-4">
      <SideBar />
      <div className="flex-1">
        <div className="flex justify-between mb-4">
          {/* <FeedTab setPlatform={setPlatform} />
          <Filter setSort={setSort} setFilterType={setFilterType} /> */}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            // console.log(item);
            return (
              <Link href={item.url} key={item.videoId} className="flex flex-col p-4 rounded">
                <div className="relative">
                  <Image
                    src={item.thumb || ''}
                    alt={item.title}
                    width={500}
                    height={500}
                    className="relative w-full object-contain rounded-md aspect-video bg-gray-200"
                  />
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
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold">{item.title}</h3>
                    <span className="text-sm text-gray-600">{item.channel.title}</span>
                    <p className="text-sm text-gray-600">
                      {item.platform} - {formatKSTDate(new Date(item.publishedAt || ''))}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
