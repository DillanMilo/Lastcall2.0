"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/utils/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import AuthLayout from "@/components/auth/AuthLayout";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/dashboard`,
        },
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          setError("This email is already registered. Please sign in instead.");
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      if (data.user && !data.session) {
        setMessage("Check your email to confirm your account.");
      } else if (data.session) {
        // User is immediately signed in (email confirmations disabled)
        await new Promise(resolve => setTimeout(resolve, 100));
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getSiteUrl()}/dashboard`,
        },
      });

      if (error) throw error;
      setMessage("Check your email for a magic link!");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start managing your inventory with AI-powered tools.">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-2xl">Sign up</CardTitle>
        <CardDescription>Create your account to get started</CardDescription>
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
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
              {error}
            </div>
          )}

          {message && (
            <div className="text-sm text-primary bg-primary/10 p-3 rounded-xl">
              {message}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleMagicLink}
              disabled={loading || !email}
              className="w-full"
            >
              Email me a magic link
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? {" "}
          <Link href="/auth/signin" className="text-primary hover:underline">Sign in</Link>
        </div>
      </CardContent>
    </AuthLayout>
  );
}


