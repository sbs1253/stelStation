'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import type { ComponentProps } from 'react';

export function RefreshIcon({ spinning = false, className }: { spinning?: boolean; className?: string }) {
  return <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin', className)} />;
}

export type RefreshButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
  label?: string;
  hideLabelOnMobile?: boolean;
};
