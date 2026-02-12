"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/utils/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";

const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "";
const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") ?? "";
  const verifyReminder = searchParams.get("verify");
  const redirectUrl = searchParams.get("redirect");
  const freshLogin = searchParams.get("fresh"); // Indicates user just signed out and needs fresh login
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [processingVerification, setProcessingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    verifyReminder
      ? "Check your inbox for the confirmation email to finish creating your account."
      : null
  );
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState(prefilledEmail);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    setEmail(prefilledEmail);
    setResetEmail(prefilledEmail);
  }, [prefilledEmail]);

  // Helper to handle redirect after successful authentication
  const handleSuccessfulAuth = useCallback(() => {
    // Check for pending invite token first
    const pendingInviteToken = localStorage.getItem("pendingInviteToken");
    if (pendingInviteToken) {
      localStorage.removeItem("pendingInviteToken"); // Clean up
      window.location.href = `/auth/invite?token=${pendingInviteToken}`;
      return;
    }
    // Check for redirect URL from query params
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }
    // Default to dashboard
    router.replace("/dashboard");
  }, [redirectUrl, router]);

  useEffect(() => {
    if (verifyReminder) {
      setMessage(
        "Check your inbox for the confirmation email to finish creating your account."
      );
    }
  }, [verifyReminder]);

  // Process email confirmation redirects and skip form if already signed in
  useEffect(() => {
    let active = true;

    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        setProcessingVerification(true);
        setMessage("Email verified! Signing you in...");
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );

          if (error) {
            if (active) {
              setProcessingVerification(false);
              setError(
                "We couldn't finish signing you in. Please try again from the sign-in form."
              );
            }
            return;
          }

          if (data.session && active) {
            // Email verification - mark as active session
            // Don't auto-remember, user can sign in again with "remember me" if they want
            sessionStorage.setItem("activeSession", "true");
            handleSuccessfulAuth();
            return;
          }
        } catch (err: unknown) {
          if (active) {
            setProcessingVerification(false);
            const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(errorMessage);
          }
          return;
        }
      }

      // Skip auto-redirect if this is a fresh login (user just signed out to switch accounts)
      if (freshLogin === "1") {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && active) {
        handleSuccessfulAuth();
      }
    };

    handleAuthCallback();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only redirect on SIGNED_IN event (actual login), not on initial session detection
      // This prevents redirect loops when coming from fresh logout
      if (session && event === "SIGNED_IN") {
        handleSuccessfulAuth();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [handleSuccessfulAuth, freshLogin]);

  const disableForm = useMemo(
    () => loading || demoLoading || processingVerification,
    [loading, demoLoading, processingVerification]
  );

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableForm) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setError("Please confirm your email before signing in.");
        } else if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(error.message || "Unable to sign in right now.");
        }
        setLoading(false);
        return;
      }

      // Store remember me preference and session state
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        sessionStorage.setItem("activeSession", "true");
      } else {
        localStorage.removeItem("rememberMe");
        // Only set activeSession for this tab - session will end when tab closes
        sessionStorage.setItem("activeSession", "true");
      }

      setMessage("Signing you in...");
      handleSuccessfulAuth();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unable to sign in right now.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    if (!demoEmail || !demoPassword) {
      setError(
        "Demo account credentials are not configured. Add NEXT_PUBLIC_DEMO_EMAIL and NEXT_PUBLIC_DEMO_PASSWORD to your .env.local file."
      );
      return;
    }

    setDemoLoading(true);
    setError(null);
    setMessage("Loading the demo dashboard...");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error) {
        setDemoLoading(false);
        setError(
          error.message ||
            "Unable to sign in to the demo account. Please confirm the credentials exist in Supabase."
        );
        return;
      }

      // Demo logins don't persist - session only
      localStorage.removeItem("rememberMe");
      sessionStorage.setItem("activeSession", "true");

      handleSuccessfulAuth();
    } catch (err: unknown) {
      setDemoLoading(false);
      const errorMessage = err instanceof Error ? err.message : "Unable to sign in to the demo account.";
      setError(errorMessage);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetFeedback("Enter the email associated with your account.");
      return;
    }

    setResetLoading(true);
    setResetFeedback(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail,
        {
          redirectTo: `${getSiteUrl()}/auth/reset`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setResetFeedback(
        "Password reset email sent! Check your inbox for the link."
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unable to send password reset email.";
      setResetFeedback(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in or instantly jump into the live demo."
    >
      <CardHeader className="p-0 mb-6">
        <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
        <CardDescription className="text-sm">
          Enter your credentials to continue
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={disableForm}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={() => setShowReset((prev) => !prev)}
                className="text-sm text-primary hover:underline disabled:opacity-50"
                disabled={disableForm}
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={disableForm}
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={disableForm}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
              Remember me
            </Label>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          {message && (
            <div className="text-sm text-primary bg-primary/10 p-3 rounded-lg border border-primary/20">
              {message}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={disableForm} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDemoLogin}
              disabled={demoLoading || processingVerification}
              className="w-full"
            >
              {demoLoading ? "Loading demo..." : "View live demo"}
            </Button>
          </div>
        </form>

        {showReset && (
          <div className="mt-6 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a secure reset link.
            </p>
            <form onSubmit={handlePasswordReset} className="space-y-3">
              <Label htmlFor="reset-email" className="sr-only">
                Reset email
              </Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetLoading}
                autoComplete="email"
              />
              {resetFeedback && (
                <div
                  className={`text-sm ${
                    resetFeedback.includes("sent")
                      ? "text-green-600"
                      : "text-destructive"
                  }`}
                >
                  {resetFeedback}
                </div>
              )}
              <Button
                type="submit"
                variant="outline"
                disabled={resetLoading || !resetEmail}
                className="w-full"
              >
                {resetLoading ? "Sending link..." : "Send password reset link"}
              </Button>
            </form>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted-foreground">Loading…</div>}>
      <SignInContent />
    </Suspense>
  );
}
