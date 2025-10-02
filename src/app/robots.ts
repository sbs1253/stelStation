import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stelstation.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/actions/', '/admin/', '/_next/', '/static/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
