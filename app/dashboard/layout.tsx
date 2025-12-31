import { Navigation } from "@/components/dashboard/Navigation";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { DashboardWrapper } from "@/components/dashboard/DashboardWrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardWrapper>
      <div className="flex h-screen bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border/50 bg-card">
          <Navigation />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Nav */}
          <MobileNav />

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </DashboardWrapper>
  );
}
