import Ui from '@/app/(main)/ui';
export const revalidate = 30;

export default async function Home() {
  const scope = 'all';

  const base = process.env.NEXT_PUBLIC_SITE_URL!;
  const url = new URL('/api/feed', base);
  url.searchParams.set('scope', 'all');
  url.searchParams.set('sort', 'published');
  url.searchParams.set('limit', '8');
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const data = await res.json();
  console.log(data.items[5]);
  return (
    <Ui
      initialItems={data.items}
      initialHasMore={!!data?.has_more}
      initialCursor={data?.next_cursor}
      initialSort="published"
      initialFilterType="all"
      initialPlatform="all"
    />
  );
}
