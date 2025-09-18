'use client';
import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => onChange(e);
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, [breakpoint]);
  return isMobile;
}
