import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex flex-col gap-8">
        <h1 className="text-4xl font-bold mb-4">LastCall 2.0</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI-Driven Inventory Management SaaS
        </p>
        
        <div className="flex gap-4">
          <Link
            href="/auth/signin"
            className="rounded-2xl border border-solid border-transparent transition-colors flex items-center justify-center bg-primary text-primary-foreground gap-2 hover:bg-primary/90 text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-solid border-border transition-colors flex items-center justify-center hover:bg-secondary text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

