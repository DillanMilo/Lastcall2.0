"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { User, Organization } from "@/types";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCircle, Upload, Save, Loader2, CheckCircle, Lock, Shield, Users, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { UsageDashboard } from "@/components/billing/UsageDashboard";
import { TeamManagement } from "@/components/team/TeamManagement";
import { BigCommerceConnect } from "@/components/integrations/BigCommerceConnect";
import { ShopifyConnect } from "@/components/integrations/ShopifyConnect";
import { CloverConnect } from "@/components/integrations/CloverConnect";
import { ThriveValidation } from "@/components/integrations/ThriveValidation";
import { useAuth } from "@/lib/auth/AuthContext";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (AST)" },
];

export default function SettingsPage() {
  const { isOwner, isAdmin, userWithOrg, canManageBilling, canInviteMembers, canManageSettings } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [orgForm, setOrgForm] = useState({
    name: "",
    timezone: "America/Chicago",
  });
  const [orgSaving, setOrgSaving] = useState(false);

  const callBootstrapProfile = async () => {
    try {
      const response = await fetch("/api/auth/bootstrap", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        console.error(
          "Bootstrap profile error:",
          payload?.error || response.statusText
        );
        return null;
      }

      if (!payload?.user) {
        console.error("Bootstrap profile error: invalid response payload");
        return null;
      }

      return payload;
    } catch (error) {
      console.error("Bootstrap profile error:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserData = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      let profile: (User & { organization?: Organization | null }) | null =
        null;

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (userError && userError.code !== "PGRST116") {
        console.error("Error fetching user data:", userError?.message || userError);
      }

      if (userRow) {
        let organizationRecord: Organization | null = null;
        if (userRow.org_id) {
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", userRow.org_id)
            .maybeSingle();

          if (orgError) {
            console.error(
              "Error fetching organization data:",
              orgError.message || orgError
            );
          } else {
            organizationRecord = orgData as Organization;
          }
        }

        profile = {
          ...(userRow as User),
          organization: organizationRecord,
        };
      }

      if (!profile) {
        const bootstrap = await callBootstrapProfile();
        if (bootstrap?.user) {
          profile = {
            ...bootstrap.user,
            organization: bootstrap.organization ?? null,
          };
        }
      }

      if (profile) {
        setUser(profile);
        setOrganization(profile.organization ?? null);
        setFormData({
          full_name: profile.full_name || "",
          email: profile.email || authUser.email || "",
          phone: profile.phone || "",
        });
        setOrgForm({
          name: profile.organization?.name || "",
          timezone: profile.organization?.timezone || "America/Chicago",
        });
        return;
      }

      const fallbackUser: User = {
        id: authUser.id,
        email: authUser.email || "",
        full_name: authUser.user_metadata?.full_name || "",
        phone: authUser.user_metadata?.phone || "",
        avatar_url: authUser.user_metadata?.avatar_url || "",
        org_id: DEFAULT_ORG_ID,
        created_at: authUser.created_at,
      };

      setUser(fallbackUser);
      setOrganization(null);
      setFormData({
        full_name: fallbackUser.full_name || "",
        email: fallbackUser.email || "",
        phone: fallbackUser.phone || "",
      });
      setOrgForm({ name: "", timezone: "America/Chicago" });
    } catch (error) {
      console.error("Error fetching user data:", error);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const fallbackUser: User = {
          id: authUser.id,
          email: authUser.email || "",
          full_name: "",
          phone: "",
          avatar_url: "",
          org_id: DEFAULT_ORG_ID,
          created_at: authUser.created_at,
        };
        setUser(fallbackUser);
        setOrganization(null);
        setFormData({
          full_name: "",
          email: fallbackUser.email,
          phone: "",
        });
        setOrgForm({ name: "", timezone: "America/Chicago" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!user) throw new Error("No user logged in");

      const normalizedEmail = (formData.email || user.email || "").trim();
      const normalizedName = formData.full_name.trim();
      const normalizedPhone = formData.phone.trim();

      if (!normalizedEmail) {
        throw new Error("Email is required");
      }

      if (normalizedEmail !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: normalizedEmail,
        });

        if (emailError) throw emailError;
      }

      const { data: updatedUser, error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            id: user.id,
            email: normalizedEmail,
            full_name: normalizedName || null,
            phone: normalizedPhone || null,
            avatar_url: user.avatar_url || null,
            org_id: user.org_id || DEFAULT_ORG_ID,
          },
          { onConflict: "id" }
        )
        .select("*")
        .single();

      if (upsertError) throw upsertError;

      if (updatedUser) {
        let organizationRecord: Organization | null = null;
        if (updatedUser.org_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", updatedUser.org_id)
            .maybeSingle();
          organizationRecord = (orgData as Organization) ?? null;
        }

        setUser(updatedUser as User);
        setOrganization(organizationRecord);
        setFormData({
          full_name: updatedUser.full_name || "",
          email: updatedUser.email || normalizedEmail,
          phone: updatedUser.phone || "",
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      console.error("Error updating profile:", error);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("Please sign in again before changing your password.");
      return;
    }

    if (!passwordData.current) {
      setError("Enter your current password to continue.");
      return;
    }

    if (passwordData.new !== passwordData.confirm) {
      setError("New passwords do not match");
      return;
    }

    if (passwordData.new.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: formData.email || user.email,
        password: passwordData.current,
      });

      if (verifyError) {
        throw new Error("Current password is incorrect.");
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordData.new,
      });

      if (error) throw error;

      setSuccess(true);
      setPasswordData({ current: "", new: "", confirm: "" });

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to change password";
      console.error("Error changing password:", error);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      console.log("Uploading file:", fileName);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      console.log("Upload successful:", uploadData);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      console.log("Public URL:", publicUrl);

      const { data: updatedUser, error: profileError } = await supabase
        .from("users")
        .upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.full_name || null,
            phone: user.phone || null,
            avatar_url: publicUrl,
            org_id: user.org_id || DEFAULT_ORG_ID,
          },
          { onConflict: "id" }
        )
        .select("*")
        .single();

      if (profileError) throw profileError;

      if (updatedUser) {
        let organizationRecord: Organization | null = null;
        if (updatedUser.org_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", updatedUser.org_id)
            .maybeSingle();
          organizationRecord = (orgData as Organization) ?? null;
        }

        setUser(updatedUser as User);
        setOrganization(organizationRecord);
        setFormData((prev) => ({
          ...prev,
          email: updatedUser.email || prev.email,
        }));
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload avatar";
      console.error("Error uploading avatar:", error);
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleOrganizationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be signed in to manage an organization.");
      return;
    }

    setOrgSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const desiredName =
        orgForm.name.trim() ||
        `${formData.full_name || user.email?.split("@")[0] || "My"}'s Organization`;

      if (organization) {
        const { data: updatedOrg, error: orgError } = await supabase
          .from("organizations")
          .update({
            name: desiredName,
            timezone: orgForm.timezone,
          })
          .eq("id", organization.id)
          .select("*")
          .single();

        if (orgError) throw orgError;

        if (updatedOrg) {
          setOrganization(updatedOrg as Organization);
          setOrgForm({ name: updatedOrg.name || "", timezone: updatedOrg.timezone || "America/Chicago" });
        }
      } else {
        const { data: newOrg, error: createError } = await supabase
          .from("organizations")
          .insert({
            name: desiredName,
            subscription_tier: "growth",
            timezone: orgForm.timezone,
          })
          .select("*")
          .single();

        if (createError) throw createError;

        const { data: updatedUser, error: userUpdateError } = await supabase
          .from("users")
          .update({
            org_id: newOrg.id,
          })
          .eq("id", user.id)
          .select("*")
          .single();

        if (userUpdateError) throw userUpdateError;

        setOrganization(newOrg as Organization);
        setOrgForm({ name: newOrg.name || "", timezone: newOrg.timezone || "America/Chicago" });
        setUser({
          ...(updatedUser as User),
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save organization";
      console.error("Error saving organization:", error);
      setError(message);
    } finally {
      setOrgSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Please sign in to view your settings.
          </AlertDescription>
        </Alert>
        <div>
          <Link href="/auth/signin">
            <Button className="w-full sm:w-auto">
              Go to Sign In / Sign Up
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* User Info Card */}
      <Card className={isOwner ? "border-amber-500/30 bg-amber-500/5" : isAdmin ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt="Profile"
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover border-2 border-muted"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-muted">
                  <UserCircle className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
              {isOwner && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              {isAdmin && !isOwner && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold truncate">
                  {userWithOrg?.full_name || user?.full_name || user?.email?.split("@")[0] || "User"}
                </h2>
                <Badge
                  variant={isOwner ? "default" : isAdmin ? "default" : "secondary"}
                  className={isOwner ? "bg-amber-500 hover:bg-amber-600 shrink-0" : "shrink-0"}
                >
                  {isOwner ? (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Owner
                    </span>
                  ) : isAdmin ? (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Member
                    </span>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email}
              </p>
              {organization && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{organization.name}</span>
                  {" · "}
                  <span className="capitalize">{organization.subscription_tier} plan</span>
                </p>
              )}
            </div>

            {/* Owner/Admin Control Indicator */}
            {isOwner && (
              <div className="hidden md:flex flex-col items-end text-right">
                <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                  Full Control
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Billing, Team & Integrations
                </p>
              </div>
            )}
            {isAdmin && !isOwner && (
              <div className="hidden md:flex flex-col items-end text-right">
                <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                  Admin Access
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Team & Integrations
                </p>
              </div>
            )}
          </div>

          {/* Owner capabilities summary - mobile */}
          {isOwner && (
            <div className="md:hidden mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Full Control:</span>
                <span className="text-muted-foreground">Billing, Team & Integrations</span>
              </div>
            </div>
          )}

          {/* Admin capabilities summary - mobile */}
          {isAdmin && !isOwner && (
            <div className="md:hidden mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Admin Access:</span>
                <span className="text-muted-foreground">Team & Integrations</span>
              </div>
            </div>
          )}

          {/* Member limited access notice */}
          {!isAdmin && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Some settings are managed by your organization owner or admin. Contact them to make changes to billing, team members, or integrations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Message */}
      {success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Changes saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload or update your profile photo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
            <div className="relative">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt="Profile"
                  width={128}
                  height={128}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-muted"
                />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-muted flex items-center justify-center border-4 border-muted">
                  <UserCircle className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-muted-foreground mb-3">
                JPG, PNG or GIF (max. 2MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            {organization
              ? "Update your organization details"
              : "Create an organization to unlock team features"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOrganizationSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization-name">Organization Name</Label>
              <Input
                id="organization-name"
                placeholder="Add your organization name"
                value={orgForm.name}
                onChange={(e) =>
                  setOrgForm({
                    ...orgForm,
                    name: e.target.value,
                  })
                }
                disabled={orgSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Business Timezone
              </Label>
              <select
                id="timezone"
                value={orgForm.timezone}
                onChange={(e) =>
                  setOrgForm({ ...orgForm, timezone: e.target.value })
                }
                disabled={orgSaving}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-base sm:text-sm transition-all duration-200 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation [font-size:max(16px,1rem)] sm:[font-size:0.875rem]"
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Used for daily sales reports so &quot;today&quot; matches your local business day
              </p>
            </div>
            {organization && (
              <div className="text-xs text-muted-foreground">
                Subscription tier: {organization.subscription_tier}
              </div>
            )}
            <Button type="submit" disabled={orgSaving} className="w-full sm:w-auto">
              {orgSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : organization ? (
                "Update Organization"
              ) : (
                "Create Organization"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Changing your email will require verification
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Usage & Limits */}
      <UsageDashboard />

      {/* Subscription & Billing - Owner Only */}
      {canManageBilling ? (
        <SubscriptionCard
          organization={organization}
          onSubscriptionChange={fetchUserData}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Subscription & Billing
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? "Billing is managed by the organization owner."
                : "Contact your organization owner to manage billing and subscription settings."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Team Management - Owner & Admin */}
      {canInviteMembers ? (
        <TeamManagement />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Team Management
            </CardTitle>
            <CardDescription>
              Contact your organization owner or admin to manage team members and invitations.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Integrations Section - Owner & Admin */}
      {canManageSettings ? (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Connect your e-commerce platforms to sync inventory automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <BigCommerceConnect
              organization={organization}
              onConnectionChange={fetchUserData}
            />
            <ShopifyConnect
              organization={organization}
              onConnectionChange={fetchUserData}
            />
            <CloverConnect
              organization={organization}
              onConnectionChange={fetchUserData}
            />
            {/* Thrive Validation only shows when Clover is connected - used for parallel run validation */}
            {organization?.clover_merchant_id && (
              <ThriveValidation
                organization={organization}
                onStatusChange={fetchUserData}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Integrations
            </CardTitle>
            <CardDescription>
              Contact your organization owner or admin to manage e-commerce integrations.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                value={passwordData.current}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, current: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.new}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, new: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.confirm}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirm: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving || !passwordData.current || !passwordData.new || !passwordData.confirm}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
