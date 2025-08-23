import type { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
