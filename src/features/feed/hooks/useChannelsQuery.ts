'use client';

import { ChannelRow } from '@/features/creator/types';
import { useQuery } from '@tanstack/react-query';

export function useChannelsQuery() {
  return useQuery({
    queryKey: ['channels', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/channels?limit=50', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load channels');
      const json = (await res.json()) as { items: ChannelRow[] };
      return json.items;
    },
    staleTime: 5 * 60_000,
  });
}
