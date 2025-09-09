import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/app/providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'stel station',
  description: 'Hello StelStation',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const beaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
        {/* Cloudflare Web Analytics (JS Beacon) */}
        {process.env.NODE_ENV === 'production' && beaconToken ? (
          <Script
            id="cf-web-analytics"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            // SPA 라우팅 자동 추적 켜기(spa: true).
            data-cf-beacon={JSON.stringify({ token: beaconToken, spa: true })}
          />
        ) : null}
      </body>
    </html>
  );
}
