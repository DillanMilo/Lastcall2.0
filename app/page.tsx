import Link from "next/link";
import {
  Sparkles,
  Package,
  TrendingUp,
  Clock,
  ArrowRight,
  Upload,
  Bot,
  BarChart3,
  CheckCircle2,
  Zap,
  Shield,
  Users,
  Store
} from "lucide-react";

export default function Home() {
  return (
    <main className="bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-[hsl(var(--warning))]/20 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-[hsl(var(--success))]/20 rounded-full blur-3xl opacity-20" />

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center p-6 md:p-12 min-h-screen">
        <div className="max-w-4xl w-full text-center space-y-8">
          {/* Badge */}
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
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card font-medium h-12 px-8 hover:bg-muted transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Features Preview */}
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

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Quick Setup</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Up and running in <span className="text-primary">3 simple steps</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes, not hours. Our streamlined setup process gets you managing inventory faster than ever.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connection Line (desktop only) */}
            <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

            {/* Step 1 */}
            <div className="relative group">
              <div className="flex flex-col items-center text-center">
                {/* Step Number */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all group-hover:-translate-y-1">
                    <Upload className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border-2 border-primary flex items-center justify-center font-bold text-sm text-primary">
                    1
                  </div>
                </div>
                {/* Content */}
                <h3 className="text-xl font-semibold mb-3">Import Your Inventory</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Upload a CSV, connect your e-commerce store, or add items manually. We support Shopify, BigCommerce, and more.
                </p>
                {/* Features list */}
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    CSV bulk upload
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    E-commerce integrations
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Manual entry option
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="flex flex-col items-center text-center">
                {/* Step Number */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--warning))] to-[hsl(var(--warning))]/80 flex items-center justify-center shadow-lg shadow-[hsl(var(--warning))]/25 group-hover:shadow-xl group-hover:shadow-[hsl(var(--warning))]/30 transition-all group-hover:-translate-y-1">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border-2 border-[hsl(var(--warning))] flex items-center justify-center font-bold text-sm text-[hsl(var(--warning))]">
                    2
                  </div>
                </div>
                {/* Content */}
                <h3 className="text-xl font-semibold mb-3">Let AI Organize</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our AI automatically categorizes products, suggests labels, and identifies patterns in your inventory data.
                </p>
                {/* Features list */}
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Smart categorization
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Auto-tagging
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Duplicate detection
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="flex flex-col items-center text-center">
                {/* Step Number */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))]/80 flex items-center justify-center shadow-lg shadow-[hsl(var(--success))]/25 group-hover:shadow-xl group-hover:shadow-[hsl(var(--success))]/30 transition-all group-hover:-translate-y-1">
                    <BarChart3 className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border-2 border-[hsl(var(--success))] flex items-center justify-center font-bold text-sm text-[hsl(var(--success))]">
                    3
                  </div>
                </div>
                {/* Content */}
                <h3 className="text-xl font-semibold mb-3">Track & Grow</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Monitor stock levels, get reorder alerts, and make data-driven decisions with powerful analytics.
                </p>
                {/* Features list */}
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Real-time dashboards
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Low stock alerts
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                    Trend analysis
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why LastCall Section */}
      <section className="relative z-10 py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Everything you need to <span className="text-primary">manage smarter</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Enterprise-level inventory management built for small businesses, without the complexity.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-card border group hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Add, update, and search inventory in milliseconds. No lag, no waiting, just productivity.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-card border group hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-[hsl(var(--success))]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure & Reliable</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Bank-level encryption and automatic backups. Your data is safe with us, always.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-card border group hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-[hsl(var(--warning))]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Invite your team, assign roles, and work together seamlessly with real-time sync.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-card border group hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">E-commerce Ready</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connect Shopify, BigCommerce, and more. Sync inventory across all your sales channels.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-card border group hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6 text-[hsl(var(--success))]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Assistant</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Ask questions about your inventory in plain English. Get instant answers and insights.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-card border group hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-[hsl(var(--warning))]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Analytics</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Understand your inventory trends with beautiful charts and actionable insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 md:p-12 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl" />

            <div className="relative z-10 text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
                Ready to take control of your inventory?
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                Start managing your inventory smarter today. Streamline operations and reduce waste with AI-powered tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-primary font-semibold h-12 px-8 hover:bg-white/90 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 text-primary-foreground font-semibold h-12 px-8 hover:bg-white/20 transition-all border border-white/20"
                >
                  View Pricing
                </Link>
              </div>
              <p className="text-sm text-primary-foreground/60 mt-6">
                No credit card required &bull; Free 14-day trial &bull; Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 md:px-12 border-t bg-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">LastCall</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/auth/signin" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/auth/signup" className="hover:text-foreground transition-colors">Get Started</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} LastCall. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
