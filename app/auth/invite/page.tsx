"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
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
import {
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "accepting" | "success" | "error" | "creating">("loading");
  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    role: string;
    organizationName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState(false);

  // Password form state for new users
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndValidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const checkAuthAndValidate = async () => {
    if (!token) {
      setStatus("invalid");
      setError("No invite token provided");
      return;
    }

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
    setUserEmail(user?.email || null);

    // Validate the invite
    try {
      const response = await fetch(`/api/team/invites/accept?token=${token}`);
      const result = await response.json();

      if (!response.ok) {
        setStatus("invalid");
        setError(result.error || "Invalid invite");
        return;
      }

      setInviteInfo(result.invite);

      // AUTO-ACCEPT: If user is authenticated and email matches, automatically accept the invite
      // This streamlines the flow for users coming from email verification
      if (user && result.invite?.email &&
          user.email?.toLowerCase() === result.invite.email.toLowerCase()) {
        console.log('Auto-accepting invite for matching email...');
        setStatus("accepting");

        try {
          const acceptResponse = await fetch("/api/team/invites/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });

          const acceptResult = await acceptResponse.json();

          if (!acceptResponse.ok) {
            // If auto-accept fails, fall back to manual accept
            console.error('Auto-accept failed:', acceptResult);
            setStatus("valid");
            return;
          }

          setStatus("success");
          // Clean up the pending invite token
          localStorage.removeItem("pendingInviteToken");

          // Redirect to dashboard after short delay
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 2000);
          return;
        } catch (autoAcceptError) {
          console.error('Auto-accept error:', autoAcceptError);
          // Fall back to manual accept
          setStatus("valid");
          return;
        }
      }

      setStatus("valid");
    } catch {
      setStatus("invalid");
      setError("Failed to validate invite");
    }
  };

  const handleAccept = async () => {
    if (!token) return;

    setStatus("accepting");
    setError(null);

    try {
      const response = await fetch("/api/team/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || result.error || "Failed to accept invite");
        setStatus("error");
        return;
      }

      setStatus("success");

      // Redirect to dashboard after short delay - use hard refresh to reload auth state
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch {
      setError("Failed to accept invite");
      setStatus("error");
    }
  };

  const handleSignIn = async () => {
    // Store the invite token for after sign in
    localStorage.setItem("pendingInviteToken", token || "");

    // If user is logged in as wrong email, sign them out first
    if (isAuthenticated) {
      // Selectively clear auth-related keys instead of wiping all localStorage
      localStorage.removeItem("rememberMe");
      sessionStorage.removeItem("activeSession");

      await supabase.auth.signOut();
      // Small delay to ensure sign-out propagates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Properly encode the redirect URL to avoid query param parsing issues
    const redirectUrl = `/auth/invite?token=${token}`;
    window.location.href = `/auth/signin?email=${encodeURIComponent(inviteInfo?.email || "")}&redirect=${encodeURIComponent(redirectUrl)}&fresh=1`;
  };

  const handleSignUp = async () => {
    localStorage.setItem("pendingInviteToken", token || "");

    // If user is logged in as wrong email, sign them out first
    if (isAuthenticated) {
      // Selectively clear auth-related keys instead of wiping all localStorage
      localStorage.removeItem("rememberMe");
      sessionStorage.removeItem("activeSession");

      await supabase.auth.signOut();
      // Small delay to ensure sign-out propagates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Properly encode the redirect URL to avoid query param parsing issues
    const redirectUrl = `/auth/invite?token=${token}`;
    window.location.href = `/auth/signup?email=${encodeURIComponent(inviteInfo?.email || "")}&redirect=${encodeURIComponent(redirectUrl)}&fresh=1`;
  };

  // Create account with password - simplified flow for invited users
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setError(null);

    // Validate password
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setStatus("creating");

    try {
      const response = await fetch("/api/team/invites/accept-with-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          fullName: fullName.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if the error indicates an existing user
        if (result.existingUser) {
          setExistingUser(true);
          setError("An account with this email already exists. Please sign in instead.");
          setStatus("valid");
          return;
        }
        setError(result.error || "Failed to create account");
        setStatus("error");
        return;
      }

      // Account created successfully!
      setStatus("success");

      // Clean up the pending invite token
      localStorage.removeItem("pendingInviteToken");

      // Set Remember Me so they stay logged in
      localStorage.setItem("rememberMe", "true");
      sessionStorage.setItem("activeSession", "true");

      // Sign in the new user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteInfo?.email || "",
        password: password,
      });

      if (signInError) {
        console.error("Auto sign-in error:", signInError);
        // Still redirect - they can sign in manually
      }

      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (err) {
      console.error("Create account error:", err);
      setError("Failed to create account. Please try again.");
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Validating invite...</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
          <p className="text-muted-foreground text-center mb-6">{error}</p>
          <Link href="/">
            <Button variant="outline">Go to Homepage</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Welcome to the Team!</h2>
          <p className="text-muted-foreground text-center mb-6">
            You&apos;ve successfully joined {inviteInfo?.organizationName}.
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  // Handle error state with retry option
  if (status === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground text-center mb-6">{error || "Failed to accept invite"}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Link href="/auth/signin">
              <Button>Sign In</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const emailMismatch = isAuthenticated && userEmail && inviteInfo &&
    userEmail.toLowerCase() !== inviteInfo.email.toLowerCase();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Team Invite</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join a team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Details */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Organization</span>
            <span className="font-medium">{inviteInfo?.organizationName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{inviteInfo?.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Invited as</span>
            <span className="font-medium">{inviteInfo?.email}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Email Mismatch Warning */}
        {emailMismatch && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Wrong Account
            </div>
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in as <strong className="text-foreground">{userEmail}</strong>, but this invite was sent to <strong className="text-foreground">{inviteInfo?.email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Click below to sign out and use the correct account.
            </p>
          </div>
        )}

        {/* Actions */}
        {isAuthenticated && !emailMismatch ? (
          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={status === "accepting"}
          >
            {status === "accepting" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Accept Invite
          </Button>
        ) : emailMismatch ? (
          /* Email mismatch - need to switch accounts */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleSignIn}>
                Switch Account
              </Button>
              <Button onClick={handleSignUp}>
                Create Account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              You&apos;ll be signed out and can sign in as {inviteInfo?.email}
            </p>
          </div>
        ) : existingUser ? (
          /* User already has an account - prompt to sign in */
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              You already have an account. Please sign in to accept this invite.
            </p>
            <Button className="w-full" onClick={handleSignIn}>
              Sign In
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          /* New user - show password creation form */
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Create your account to join the team
            </p>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name (optional)</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={status === "creating"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status === "creating"}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={status === "creating"}
                required
                minLength={6}
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passwordError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={status === "creating"}
            >
              {status === "creating" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Create Account & Join Team
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={handleSignIn}
              >
                Sign in instead
              </button>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        }
      >
        <InviteContent />
      </Suspense>
    </main>
  );
}
