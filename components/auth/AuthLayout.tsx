"use client";
import Link from "next/link";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type AuthLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gradient-to-br from-slate-50 to-white">
      <div className="hidden md:flex relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.15),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(147,197,253,0.2),transparent_35%),radial-gradient(circle_at_40%_80%,rgba(99,102,241,0.15),transparent_40%)]" />
        <div className="relative z-10 flex w-full items-center justify-center p-12">
          <div className="max-w-md w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold">LC</span>
              </div>
              <span className="text-xl font-semibold">LastCall</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">{title ?? "Welcome back"}</h1>
            <p className="text-muted-foreground mb-8">
              {subtitle ?? "Sign in to manage inventory, get AI insights, and keep stock flowing."}
            </p>
            <div className="grid gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary">✓</span>
                </div>
                AI-driven demand forecasting
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary">✓</span>
                </div>
                One-click label generation
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary">✓</span>
                </div>
                CSV imports and bulk edits
              </div>
            </div>
            <div className="mt-10 text-xs text-muted-foreground">
              By continuing you agree to our {" "}
              <Link href="#" className="text-primary hover:underline">Terms</Link> and {" "}
              <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Card className="p-6 md:p-8 shadow-lg border-0 ring-1 ring-black/5">
            {children}
          </Card>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

