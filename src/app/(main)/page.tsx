// src/app/(main)/page.tsx
import Ui from '@/app/(main)/ui';
import { headers } from 'next/headers';

export const revalidate = 30;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const scope = typeof sp.scope === 'string' ? sp.scope : 'all';
  const sort = typeof sp.sort === 'string' ? sp.sort : 'published';
  const limit = typeof sp.limit === 'string' ? sp.limit : '24';
  const platform = typeof sp.platform === 'string' ? sp.platform : 'all';
  const filterType = typeof sp.filterType === 'string' ? sp.filterType : 'all';

  // 배포/프록시 환경에서 안전하게 호스트를 가져오기
  const host = (await headers()).get('host');
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `https://${host}` : 'http://localhost:3000');
  const url = new URL('/api/feed', base);
  url.searchParams.set('scope', scope);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', limit);
  url.searchParams.set('platform', platform);
  url.searchParams.set('filterType', filterType);

  const res = await fetch(url.toString(), { next: { revalidate } });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const data = await res.json();

  return (
    <Ui
      initialItems={data.items}
      initialHasMore={data.hasMore}
      initialCursor={data.cursor}
      initialSort={sort as 'published' | 'views_day' | 'views_week'}
      initialPlatform={platform as 'all' | 'youtube' | 'chzzk'}
      initialFilterType={filterType as 'all' | 'video' | 'short' | 'vod'}
    />
  );
}
