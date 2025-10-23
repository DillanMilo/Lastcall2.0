import { Navigation } from "@/components/dashboard/Navigation";
import { MobileNav } from "@/components/dashboard/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card">
        <Navigation />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
