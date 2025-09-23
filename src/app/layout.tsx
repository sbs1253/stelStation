import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import Providers from '@/app/providers';
import GaTracker from '@/app/ga-tracker';
import { Suspense } from 'react';
import localFont from 'next/font/local';

const pretendard = localFont({
  src: '../fonts/pretendard/PretendardVariable.woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--font-pretendard',
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
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gaEnabled = process.env.NODE_ENV === 'production' && !!gaId && process.env.NEXT_PUBLIC_ENABLE_GA !== 'false';
  return (
    <html lang="ko" suppressHydrationWarning className={`${pretendard.variable} antialiased`}>
      <body className="h-full overflow-hidden">
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

        {/* GA4 (프로덕션 & 활성화 시에만 로드) */}
        {gaEnabled ? (
          <>
            <Script
              id="ga4-src"
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                // SPA는 자동 page_view 비활성화 후 라우트 변경 때 수동 전송
                gtag('config', '${gaId}', { send_page_view: false });
              `}
            </Script>
            <Suspense fallback={null}>
              <GaTracker />
            </Suspense>
          </>
        ) : null}
      </body>
    </html>
  );
}
