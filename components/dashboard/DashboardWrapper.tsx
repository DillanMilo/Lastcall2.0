"use client";

import { FloatingAIButton } from "@/components/ui/FloatingAIButton";

interface DashboardWrapperProps {
  children: React.ReactNode;
}

export function DashboardWrapper({ children }: DashboardWrapperProps) {
  return (
    <>
      {children}
      <FloatingAIButton />
    </>
  );
}
