'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendPageView } from '@/lib/analytics/ga';

export default function GaTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams?.toString();
    const path = q ? `${pathname}?${q}` : pathname;
    sendPageView(path);
  }, [pathname, searchParams]);

  return null;
}
