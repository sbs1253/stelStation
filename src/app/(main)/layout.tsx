import type { ReactNode } from 'react';
interface MainLayoutProps {
  children: ReactNode;
}
import { SidebarProvider } from '@/components/ui/sidebar';
import CreatorSidebar from '@/features/feed/components/CreatorSidebar';
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="w-full bg-background text-foreground">
      <SidebarProvider>
        <CreatorSidebar />
        {children}
      </SidebarProvider>
    </div>
  );
}
