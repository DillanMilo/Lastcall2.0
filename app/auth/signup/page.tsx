"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/utils/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import AuthLayout from "@/components/auth/AuthLayout";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") ?? "";
  const redirectUrl = searchParams.get("redirect");

  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill email from query params
  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // Build the email redirect URL - if there's a pending invite, include it
      const baseRedirectUrl = `${getSiteUrl()}/auth/signin`;
      const emailRedirectUrl = redirectUrl
        ? `${baseRedirectUrl}?redirect=${encodeURIComponent(redirectUrl)}`
        : baseRedirectUrl;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectUrl,
        },
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("User already registered")
        ) {
          setError("This email is already registered. Please sign in instead.");
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      if (data.user && !data.session) {
        // Redirect to signin with verify flag, preserving the redirect URL
        const signinUrl = redirectUrl
          ? `/auth/signin?verify=1&email=${encodeURIComponent(email.trim())}&redirect=${encodeURIComponent(redirectUrl)}`
          : `/auth/signin?verify=1&email=${encodeURIComponent(email.trim())}`;
        router.push(signinUrl);
        return;
      }

      if (data.session) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        // New signups don't auto-remember - user can sign in with "remember me" later
        sessionStorage.setItem("activeSession", "true");
        // Check for pending invite or redirect URL
        const pendingInviteToken = localStorage.getItem("pendingInviteToken");
        if (pendingInviteToken) {
          window.location.href = `/auth/invite?token=${pendingInviteToken}`;
        } else if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          window.location.href = "/dashboard";
        }
        return;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during sign up";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start managing your inventory with AI-powered tools.">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="text-2xl font-bold">Create account</CardTitle>
        <CardDescription className="text-sm">Start managing your inventory today</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? {" "}
          <Link href="/auth/signin" className="text-primary hover:underline">Sign in</Link>
        </div>
      </CardContent>
    </AuthLayout>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted-foreground">Loading…</div>}>
      <SignUpContent />
    </Suspense>
  );
}
