'use client';

import CreatorSidebar from '@/features/feed/components/CreatorSidebar';
import FeedCard from '@/features/feed/components/FeedCard';
import FeedControls from '@/features/feed/components/FeedControls';
import { useFeedQuery } from '@/features/feed/hooks/useFeedQuery';
import { getFeedPageSize } from '@/features/feed/utils/pageSize';
import { useInfiniteSentinel } from '@/features/feed/hooks/useInfiniteSentinel';
import { useUrlFeedState } from '@/features/feed/hooks/useUrlFeedState';
import { useEffect, useRef, useState } from 'react';
import FeedSkeleton from '@/features/feed/components/FeedSkeleton';
import FeedError from '@/features/feed/components/FeedError';

export default function Ui() {
  const {
    scope,
    creatorId,
    channelIds,
    platform,
    sort,
    filterType,
    pendingPlatform,
    isNavPending,
    setParam,
    setParams,
  } = useUrlFeedState();
  const {
    data: items = [],
    status,
    error,
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
    rootMargin: '100px 0px',
    threshold: 0,
    delay: 500,
  });
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [platform, sort, filterType]);

  return (
    <div className="flex w-full h-screen min-h-0">
      <CreatorSidebar className="flex-shrink-0" />

      <main
        ref={mainRef}
        className={`flex-1 overflow-y-auto ${isFetching || isNavPending ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 border-b ">
          <FeedControls
            platform={platform}
            sort={sort}
            filterType={filterType}
            onChange={setParam}
            pendingPlatform={pendingPlatform}
            isFetching={isFetching}
          />
        </div>

        <div className="p-4">
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
