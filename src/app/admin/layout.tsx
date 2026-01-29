import { SidebarProvider } from '@/components/ui/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-background text-foreground">
      <SidebarProvider>{children}</SidebarProvider>
    </div>
  );
}
