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
      <div 
        className="flex bg-background"
        style={{
          minHeight: "100vh",
          minHeight: "100dvh",
        }}
      >
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border/50 bg-card md:sticky md:top-0 md:h-screen">
          <Navigation />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Mobile Nav */}
          <MobileNav />

          {/* Page Content */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div 
              className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8"
              style={{
                paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom, 0px) + 5rem))",
              }}
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </DashboardWrapper>
  );
}
