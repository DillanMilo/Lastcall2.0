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
            href="/auth/signup"
            className="rounded-2xl border border-solid border-transparent transition-colors flex items-center justify-center bg-slate-900 text-white hover:bg-slate-800 shadow-lg text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            Night Sign Up
          </Link>
        </div>
        <section className="w-full max-w-3xl px-6 py-8 mt-8 bg-slate-900 text-slate-100 rounded-3xl shadow-xl border border-slate-800">
          <h2 className="text-2xl font-semibold mb-4">Night Sign-Up Procedure</h2>
          <p className="text-sm md:text-base text-slate-300 mb-4">
            Set your team up for success even after hours with this quick evening checklist.
            Follow these steps to register a new account and be ready for the next business day.
          </p>
          <ol className="list-decimal list-inside space-y-3 text-sm md:text-base text-slate-200">
            <li>
              Click the <span className="font-semibold">Night Sign Up</span> button to open the registration form.
            </li>
            <li>
              Use a monitored email address so overnight notifications reach the right person.
            </li>
            <li>
              Choose a strong password and enable two-factor authentication during setup.
            </li>
            <li>
              Review the confirmation email before morning operations to verify access.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
