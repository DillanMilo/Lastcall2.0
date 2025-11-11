import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-12 lg:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center flex flex-col gap-4 md:gap-8 text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4">
          LastCall 2.0
        </h1>
        <p className="text-base md:text-xl lg:text-2xl text-muted-foreground mb-4 md:mb-8 px-4">
          AI-Driven Inventory Management SaaS
        </p>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full max-w-xl px-4">
          <Link
            href="/auth/signin"
            className="rounded-2xl border border-solid border-transparent transition-colors flex items-center justify-center bg-primary text-primary-foreground gap-2 hover:bg-primary/90 text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-solid border-border transition-colors flex items-center justify-center hover:bg-secondary text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            Dashboard
          </Link>
          <Link
            href="#signup-guide"
            className="rounded-2xl border border-solid border-transparent transition-colors flex items-center justify-center bg-slate-900 text-white hover:bg-slate-800 shadow-lg text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            Sign Up
          </Link>
        </div>
        <section
          id="signup-guide"
          className="w-full max-w-3xl px-6 py-8 mt-8 bg-slate-900 text-slate-100 rounded-3xl shadow-xl border border-slate-800"
        >
          <h2 className="text-2xl font-semibold mb-4">Sign-Up Procedure</h2>
          <p className="text-sm md:text-base text-slate-300 mb-6">
            Ready to join LastCall 2.0? Follow this quick checklist to create your account and unlock AI-powered
            inventory management. Everything you need to get started is only a few clicks away.
          </p>
          <ol className="list-decimal list-inside space-y-3 text-sm md:text-base text-slate-200">
            <li>
              Click the <span className="font-semibold">Sign Up</span> button above to jump to the registration steps.
            </li>
            <li>
              On the sign-up page, enter your <span className="font-semibold">work email</span> and create a strong password
              (minimum 8 characters, mix of letters &amp; numbers).
            </li>
            <li>
              Confirm your password, then choose between the standard sign-up or request a
              <span className="font-semibold"> magic link</span> for passwordless access.
            </li>
            <li>
              Check your inbox for the verification email, click the confirmation link, and you&apos;re ready to explore the dashboard.
            </li>
          </ol>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm sm:text-base font-medium shadow-md transition hover:bg-primary/90"
            >
              Go to Sign-Up Form
            </Link>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm sm:text-base font-medium text-slate-100 transition hover:bg-secondary"
            >
              Already have an account? Sign In
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
