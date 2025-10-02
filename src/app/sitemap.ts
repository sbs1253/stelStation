import type { MetadataRoute } from 'next';
import { supabaseService } from '@/lib/supabase/service';

export const revalidate = 60 * 60; // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stelstation.com';

  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ];

  try {
    const { data, error } = await supabaseService
      .from('creators')
      .select('slug, updated_at')
      .not('slug', 'is', null);

    if (!error && data) {
      data
        .map((row) => ({
          slug: typeof row.slug === 'string' ? row.slug.trim() : '',
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
        }))
        .filter((row) => row.slug.length > 0)
        .forEach((row) => {
          entries.push({
            url: `${siteUrl}/creators/${row.slug}`,
            lastModified: row.updatedAt ?? new Date(),
            changeFrequency: 'hourly',
            priority: 0.8,
          });
        });
    }
  } catch (err) {
    console.error('sitemap fetch error', err);
  }

  return entries;
}
