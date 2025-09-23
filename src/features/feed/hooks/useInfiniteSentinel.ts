'use client';

import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export function useInfiniteSentinel(opts: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  rootMargin?: string;
  threshold?: number;
  delay?: number;
}) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage, rootMargin = '100px 0px', threshold = 0, delay = 400 } = opts;

  const { ref, inView } = useInView({ root: null, rootMargin, threshold, delay });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ref };
}
