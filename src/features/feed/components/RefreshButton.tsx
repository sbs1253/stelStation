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

export function RefreshButton({
  loading = false,
  label = '새로고침',
  hideLabelOnMobile = false,
  className,
  disabled,
  children,
  ...props
}: RefreshButtonProps) {
  const showLabel = label && label.length > 0;
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={className}
    >
      <RefreshIcon spinning={loading} className={cn(showLabel && (hideLabelOnMobile ? 'sm:mr-2' : 'mr-2'))} />
      {showLabel ? <span className={hideLabelOnMobile ? 'hidden sm:inline' : undefined}>{label}</span> : null}
      {children}
    </Button>
  );
}
