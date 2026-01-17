"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "accepting" | "success" | "error">("loading");
  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    role: string;
    organizationName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
      // Clear all local storage except the invite token
      const inviteToken = localStorage.getItem("pendingInviteToken");
      localStorage.clear();
      if (inviteToken) localStorage.setItem("pendingInviteToken", inviteToken);

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
      // Clear all local storage except the invite token
      const inviteToken = localStorage.getItem("pendingInviteToken");
      localStorage.clear();
      if (inviteToken) localStorage.setItem("pendingInviteToken", inviteToken);

      await supabase.auth.signOut();
      // Small delay to ensure sign-out propagates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Properly encode the redirect URL to avoid query param parsing issues
    const redirectUrl = `/auth/invite?token=${token}`;
    window.location.href = `/auth/signup?email=${encodeURIComponent(inviteInfo?.email || "")}&redirect=${encodeURIComponent(redirectUrl)}&fresh=1`;
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
        ) : (
          <div className="space-y-3">
            {!emailMismatch && (
              <p className="text-sm text-center text-muted-foreground">
                Sign in or create an account to accept this invite
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleSignIn}>
                {emailMismatch ? "Switch Account" : "Sign In"}
              </Button>
              <Button onClick={handleSignUp}>
                {emailMismatch ? "Create Account" : "Sign Up"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            {emailMismatch && (
              <p className="text-xs text-center text-muted-foreground">
                You&apos;ll be signed out and can sign in as {inviteInfo?.email}
              </p>
            )}
          </div>
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
