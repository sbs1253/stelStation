'use client';

import FeedSkeleton from '@/features/feed/components/FeedSkeleton';
import { getFeedPageSize } from '@/features/feed/utils/pageSize';

const pageSize = getFeedPageSize('all');

export default function MainLoading() {
  return (
    <div className="flex w-full h-screen min-h-0">
      <main className="flex-1 overflow-y-auto p-4">
        <FeedSkeleton count={pageSize} />
      </main>
    </div>
  );
}
