import { Navigation } from "@/components/dashboard/Navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-card">
        <Navigation />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}

