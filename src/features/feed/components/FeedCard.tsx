'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import youtube_icon from '@/assets/icons/youtube_Icon.png';
import chzzk_icon from '@/assets/icons/chzzk_Icon.png';
import { formatDuration } from '@/lib/time/duration';
import { formatKSTFriendlyDate, formatKSTLiveTime } from '@/lib/time/kst';
import type { FeedItem } from '../../feed/types';

function compact(n?: number | null) {
  if (n == null) return '';
  return new Intl.NumberFormat('ko', { notation: 'compact' }).format(n);
}

export default function FeedCard({ item, priority }: { item: FeedItem; priority: boolean }) {
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
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? 'eager' : 'lazy'}
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
