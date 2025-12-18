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
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
      </main>

      {/* Mobile Menu */}
      <MobileNav />
    </div>
  );
}
