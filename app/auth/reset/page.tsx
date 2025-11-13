"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthLayout from "@/components/auth/AuthLayout";
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

type ResetStage = "checking" | "form" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<ResetStage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const hash = window.location.hash;
        if (hash.includes("access_token")) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              throw sessionError;
            }

            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search
            );
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError(
            "This reset link is invalid or has expired. Please request a new one."
          );
          setStage("error");
          return;
        }

        setStage("form");
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unable to verify reset link.";
        setError(errorMessage);
        setStage("error");
      }
    };

    verifySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setStage("success");
      setPassword("");
      setConfirm("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unable to update password.";
      setError(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const renderContent = () => {
    if (stage === "checking") {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Checking your reset link...
        </div>
      );
    }

    if (stage === "error") {
      return (
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
              {error}
            </div>
          )}
          <Button onClick={() => router.push("/auth/signin")} className="w-full">
            Back to sign in
          </Button>
        </div>
      );
    }

    if (stage === "success") {
      return (
        <div className="space-y-4 text-center">
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-xl">
            Password updated! You can now sign in with your new password.
          </div>
          <Button onClick={() => router.push("/auth/signin")} className="w-full">
            Return to sign in
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={updating}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="Re-enter your new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={updating}
          />
        </div>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
            {error}
          </div>
        )}
        <Button type="submit" disabled={updating} className="w-full">
          {updating ? "Updating password..." : "Update password"}
        </Button>
      </form>
    );
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Choose a new password to regain access to your account."
    >
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>
          Your password must be at least 6 characters long.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 space-y-4">{renderContent()}</CardContent>
      <CardContent className="p-0 mt-6 text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/auth/signin" className="text-primary hover:underline">
          Sign in
        </Link>
      </CardContent>
    </AuthLayout>
  );
}
