"use client";

import { usePathname } from "next/navigation";

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const pathname = usePathname();

  // Using pathname as key forces React to remount children when navigating
  // This ensures CSS animations with opacity-0 replay correctly
  return <div key={pathname}>{children}</div>;
}
