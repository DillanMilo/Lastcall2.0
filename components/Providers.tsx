"use client";

import { AuthProvider } from "@/lib/auth/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
