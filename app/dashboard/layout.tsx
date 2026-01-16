import { Navigation } from "@/components/dashboard/Navigation";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { DashboardWrapper } from "@/components/dashboard/DashboardWrapper";
import { PageWrapper } from "@/components/dashboard/PageWrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardWrapper>
      <div className="flex bg-background min-h-screen-ios">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border/50 bg-card md:sticky md:top-0 md:h-screen">
          <Navigation />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Mobile Nav */}
          <MobileNav />

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 dashboard-content-padding">
              <PageWrapper>{children}</PageWrapper>
            </div>
          </div>
        </main>
      </div>
    </DashboardWrapper>
  );
}
