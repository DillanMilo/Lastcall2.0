import Link from "next/link";
import { Sparkles, Package, TrendingUp, Clock, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="bg-background relative overflow-hidden min-h-screen-ios">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[hsl(var(--warning))]/20 rounded-full blur-3xl opacity-20" />

      <div className="relative z-10 flex flex-col items-center justify-center p-6 md:p-12 min-h-screen-ios">
        <div className="max-w-4xl w-full text-center space-y-8">
          {/* Logo */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border shadow-sm animate-fade-up">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered Inventory</span>
          </div>

          {/* Hero Text */}
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="block">Inventory that</span>
              <span className="block text-primary">thinks ahead</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Smart inventory management for small businesses.
              Reduce waste, predict demand, and never run out of stock.
            </p>
          </div>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up"
            style={{ animationDelay: '200ms' }}
          >
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-medium h-12 px-8 hover:bg-primary/90 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card font-medium h-12 px-8 hover:bg-muted transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Features */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 animate-fade-up"
            style={{ animationDelay: '300ms' }}
          >
            <div className="p-6 rounded-xl bg-card/50 border backdrop-blur-sm text-left group hover:bg-card transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Smart Tracking</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered categorization and real-time stock monitoring
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card/50 border backdrop-blur-sm text-left group hover:bg-card transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
              </div>
              <h3 className="font-semibold mb-1">Expiry Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Never waste products with proactive expiration tracking
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card/50 border backdrop-blur-sm text-left group hover:bg-card transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" />
              </div>
              <h3 className="font-semibold mb-1">Reorder Predictions</h3>
              <p className="text-sm text-muted-foreground">
                Know when to restock before you run out
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="absolute bottom-6 text-center animate-fade-up"
          style={{ animationDelay: '400ms' }}
        >
          <p className="text-xs text-muted-foreground">
            Smart inventory for growing businesses
          </p>
        </div>
      </div>
    </main>
  );
}
