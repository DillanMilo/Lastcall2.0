"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
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

  const handleSignIn = () => {
    // Store the invite token for after sign in
    localStorage.setItem("pendingInviteToken", token || "");
    router.push(`/auth/signin?redirect=/auth/invite?token=${token}`);
  };

  const handleSignUp = () => {
    localStorage.setItem("pendingInviteToken", token || "");
    router.push(`/auth/signup?email=${encodeURIComponent(inviteInfo?.email || "")}&redirect=/auth/invite?token=${token}`);
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
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            You&apos;re signed in as {userEmail}, but this invite is for {inviteInfo?.email}.
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
            <p className="text-sm text-center text-muted-foreground">
              {emailMismatch
                ? "Sign in with the correct email to accept"
                : "Sign in or create an account to accept"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleSignIn}>
                Sign In
              </Button>
              <Button onClick={handleSignUp}>
                Sign Up
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
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
