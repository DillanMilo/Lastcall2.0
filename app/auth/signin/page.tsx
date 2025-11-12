"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/utils/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Check for email confirmation callback and handle session
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check if this is an email confirmation callback
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // This is an email confirmation callback
        try {
          // Exchange the tokens for a session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            setError('Failed to complete sign in. Please try signing in again.');
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }

          if (data.session) {
            // Successfully authenticated, redirect to dashboard
            router.push('/dashboard');
            return;
          }
        } catch (err: any) {
          console.error('Error handling auth callback:', err);
          setError('Failed to complete sign in. Please try signing in again.');
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        // Not a callback - check for stale tokens only if there's an error
        // Don't clear valid sessions
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error && error.message?.includes('Refresh Token')) {
          // Only clear if there's a refresh token error
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
      }
    };

    handleAuthCallback();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account before signing in.');
        } else {
          setError(error.message || "An error occurred during sign in");
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        // Wait a bit for session to be saved and auth state to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify session is still valid
        const { data: { session: verifySession } } = await supabase.auth.getSession();
        if (verifySession) {
          // Use window.location for more reliable redirect
          window.location.href = "/dashboard";
        } else {
          setError("Session expired. Please try signing in again.");
          setLoading(false);
        }
      } else {
        setError("Sign in failed. Please try again.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || "An error occurred during sign in");
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
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your dashboard.">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>Enter your credentials to access LastCall</CardDescription>
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
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="#" className="text-sm text-primary hover:underline">Forgot password?</Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Signing in..." : "Sign In"}
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
          Don&apos;t have an account? {" "}
          <Link href="/auth/signup" className="text-primary hover:underline">Sign up</Link>
        </div>
      </CardContent>
    </AuthLayout>
  );
}
