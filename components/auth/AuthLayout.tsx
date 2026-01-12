"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, Package, TrendingUp, Clock, ArrowLeft } from "lucide-react";

type AuthLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 bg-background min-h-screen-ios">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex relative overflow-hidden bg-card">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Gradient Orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-[hsl(var(--warning))]/20 rounded-full blur-3xl opacity-30" />

        <div className="relative z-10 flex w-full items-center justify-center p-12">
          <div className="max-w-md w-full animate-fade-up">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <span className="text-xl font-bold block">LastCallIQ</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Inventory</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              {title ?? "Welcome back"}
            </h1>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              {subtitle ?? "Sign in to manage inventory, get AI insights, and keep stock flowing."}
            </p>

            {/* Features */}
            <div className="space-y-4">
              <div
                className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 animate-fade-up opacity-0"
                style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">AI-Powered Tracking</p>
                  <p className="text-xs text-muted-foreground">Smart categorization and stock monitoring</p>
                </div>
              </div>
              <div
                className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 animate-fade-up opacity-0"
                style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
              >
                <div className="h-10 w-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
                </div>
                <div>
                  <p className="font-medium text-sm">Expiry Alerts</p>
                  <p className="text-xs text-muted-foreground">Never waste products again</p>
                </div>
              </div>
              <div
                className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 animate-fade-up opacity-0"
                style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
              >
                <div className="h-10 w-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" />
                </div>
                <div>
                  <p className="font-medium text-sm">Reorder Predictions</p>
                  <p className="text-xs text-muted-foreground">Know when to restock</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link href="#" className="text-primary hover:underline">Terms</Link> and{" "}
              <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-screen-ios">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 animate-fade-up">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold">LastCallIQ</span>
          </div>

          <Card
            variant="default"
            className="p-6 sm:p-8 shadow-lg animate-fade-up"
            style={{ animationDelay: '50ms' }}
          >
            {children}
          </Card>

          <div
            className="mt-6 text-center animate-fade-up"
            style={{ animationDelay: '100ms' }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
