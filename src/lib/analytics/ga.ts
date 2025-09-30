export function getGaId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
}

export function isGaEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
}

export function sendGaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !isGaEnabled()) return;
  (window as any).gtag?.('event', name, params ?? {});
}

export function sendPageView(path: string) {
  if (typeof window === 'undefined' || !isGaEnabled()) return;
  (window as any).gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}
