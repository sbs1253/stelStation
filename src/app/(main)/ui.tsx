'use client';

import FeedCard from '@/features/feed/components/FeedCard';
import FeedControls from '@/features/feed/components/FeedControls';
import { useFeedQuery } from '@/features/feed/hooks/useFeedQuery';
import { getFeedPageSize } from '@/features/feed/utils/pageSize';
import { useInfiniteSentinel } from '@/features/feed/hooks/useInfiniteSentinel';
import { useUrlFeedState } from '@/features/feed/hooks/useUrlFeedState';
import { useEffect, useRef } from 'react';
import FeedSkeleton from '@/features/feed/components/FeedSkeleton';
import FeedError from '@/features/feed/components/FeedError';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { FeedScope } from '@/features/feed/types';

type FeedStateDefaults = {
  scope?: FeedScope;
  creatorId?: string | null;
  channelIds?: string[];
};

export default function Ui({ initialState }: { initialState?: FeedStateDefaults } = {}) {
  const { scope, creatorId, channelIds, platform, sort, filterType, pendingPlatform, isNavPending, setParam } =
    useUrlFeedState(initialState);
  const {
    data: items = [],
    status,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = useFeedQuery({ scope, creatorId, channelIds, platform, sort, filterType });
  const pageSize = getFeedPageSize(scope);

  const { ref: loadMoreRef } = useInfiniteSentinel({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    rootMargin: '10px 0px',
    threshold: 0,
    delay: 500,
  });
  const mainRef = useRef<HTMLDivElement>(null);
  const channelKey = channelIds.length ? channelIds.join(',') : '';

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [platform, sort, filterType, scope, creatorId, channelKey]);

  return (
    <div className="flex w-full h-screen min-h-0">
      <main
        ref={mainRef}
        className={`flex-1 overflow-y-auto ${isFetching || isNavPending ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 border-b ">
          <div className="flex">
            <SidebarTrigger className="relative left-[-5px]" />
            <FeedControls
              platform={platform}
              sort={sort}
              filterType={filterType}
              onChange={setParam}
              pendingPlatform={pendingPlatform}
              isFetching={isFetching}
              refetch={refetch}
            />
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
            StelStation은 스텔라이브의 공식 서비스가 아닙니다. 스텔라이브를 응원하는 팬이 제작한 비공식 통합 플랫폼으로,
            사이트 내 모든 콘텐츠(영상, 썸네일 등)의 저작권은 원저작자에게 있습니다.
          </div>
          {status === 'pending' && <FeedSkeleton count={pageSize} />}

          {status === 'error' && <FeedError isFetching={isFetching} refetch={refetch} />}

          {status === 'success' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item, index) => (
                  <FeedCard key={item.videoId} item={item} priority={index < 6} />
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
