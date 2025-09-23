'use client';

import SideBar from '@/features/feed/components/SideBar';
import FeedCard from '@/features/feed/components/FeedCard';
import FeedControls from '@/features/feed/components/FeedControls';
import { useFeedQuery } from '@/features/feed/hooks/useFeedQuery';
import { useInfiniteSentinel } from '@/features/feed/hooks/useInfiniteSentinel';
import { useUrlFeedState } from '@/features/feed/hooks/useUrlFeedState';

export default function Ui() {
  const { platform, sort, filterType, pendingPlatform, isNavPending, setParam } = useUrlFeedState();

  const {
    data: items = [],
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    refetch,
  } = useFeedQuery({ platform, sort, filterType });

  const { ref: loadMoreRef } = useInfiniteSentinel({
    hasNextPage,
    isFetchingNextPage: !!isFetchingNextPage,
    fetchNextPage,
    rootMargin: '100px 0px',
    threshold: 0,
    delay: 500,
  });

  return (
    <div className="flex w-full h-screen min-h-0">
      <SideBar className="flex-shrink-0" />

      <main className={`flex-1 overflow-y-auto ${isNavPending && 'opacity-70 pointer-events-none'}`}>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 border-b">
          <FeedControls
            platform={platform}
            sort={sort}
            filterType={filterType}
            onChange={setParam}
            pendingPlatform={pendingPlatform}
            isNavPending={isNavPending}
          />
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
                disabled={!!isFetching}
              >
                {isFetching ? '재시도 중...' : '다시 시도'}
              </button>
            </div>
          )}

          {status === 'success' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                  <FeedCard key={item.videoId} item={item} />
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
