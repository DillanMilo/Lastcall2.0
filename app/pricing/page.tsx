import Link from "next/link";
import { Sparkles, Check, ArrowRight, ArrowLeft } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Free Trial",
    description: "Try LastCallIQ free for 14 days",
    price: 0,
    features: [
      "Up to 50 products",
      "1 user",
      "Basic inventory tracking",
      "CSV import",
      "50 AI requests/month",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small shops",
    price: 99,
    features: [
      "Up to 500 products",
      "2 users",
      "Full inventory tracking",
      "CSV import",
      "Expiry alerts",
      "500 AI requests/month",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing businesses",
    price: 149,
    popular: true,
    features: [
      "Up to 2,000 products",
      "5 users",
      "Full inventory tracking",
      "CSV import",
      "Expiry alerts",
      "Smart ordering recommendations",
      "2,000 AI requests/month",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For scaling operations",
    price: 299,
    features: [
      "Up to 10,000 products",
      "15 users",
      "Full inventory tracking",
      "CSV import",
      "Expiry alerts",
      "Smart ordering recommendations",
      "API access",
      "10,000 AI requests/month",
      "Dedicated support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    price: 799,
    features: [
      "Unlimited products",
      "Unlimited users",
      "Full inventory tracking",
      "CSV import",
      "Expiry alerts",
      "Smart ordering recommendations",
      "API access",
      "Unlimited AI requests",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="bg-background relative overflow-hidden min-h-screen">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[hsl(var(--warning))]/20 rounded-full blur-3xl opacity-20" />

      <div className="relative z-10 px-6 py-12 md:py-20">
        {/* Header */}
        <div className="max-w-7xl mx-auto">
          {/* Back Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          {/* Title */}
          <div className="text-center mb-12 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border shadow-sm mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Simple Pricing</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Choose your plan
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you need more. All plans include a 14-day
              money-back guarantee.
            </p>
          </div>

          {/* Pricing Grid */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            {PLANS.map((plan, index) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-card/50 backdrop-blur-sm p-6 transition-all hover:bg-card hover:shadow-lg ${
                  plan.popular
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-primary/50"
                }`}
                style={{ animationDelay: `${(index + 1) * 50}ms` }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/mo</span>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.price === 0 ? "/auth/signup" : "/auth/signup"}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium h-11 px-6 transition-all ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border bg-background hover:bg-muted"
                  }`}
                >
                  {plan.price === 0 ? "Start Free Trial" : "Get Started"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ / Trust */}
          <div
            className="mt-16 text-center animate-fade-up"
            style={{ animationDelay: "300ms" }}
          >
            <p className="text-muted-foreground mb-6">
              Questions? Email us at{" "}
              <a
                href="mailto:support@lastcalliq.com"
                className="text-primary hover:underline"
              >
                support@lastcalliq.com
              </a>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                No credit card required for trial
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                Cancel anytime
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                14-day money-back guarantee
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
