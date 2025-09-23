import type { ReactNode } from 'react';
import Header from '@/components/layout/hearder';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return <div className="w-full bg-background text-foreground">{children}</div>;
}
