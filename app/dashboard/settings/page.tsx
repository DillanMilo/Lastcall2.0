"use client";

import { useState, useEffect, useRef } from "react";
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
import { UserCircle, Upload, Save, Loader2, CheckCircle } from "lucide-react";

export default function SettingsPage() {
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

  useEffect(() => {
    fetchUserData();
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

      // Get user data from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*, organization:organizations(*)")
        .eq("id", authUser.id)
        .single();

      // If user doesn't exist in users table, create a basic user object
      if (userError || !userData) {
        console.log("User not found in users table, creating default user");

        // Create a minimal user object from auth data
        const defaultUser: User = {
          id: authUser.id,
          email: authUser.email || "",
          full_name: authUser.user_metadata?.full_name || "",
          phone: authUser.user_metadata?.phone || "",
          avatar_url: authUser.user_metadata?.avatar_url || "",
          org_id: "00000000-0000-0000-0000-000000000001", // Default org
          created_at: authUser.created_at,
        };

        setUser(defaultUser);
        setFormData({
          full_name: defaultUser.full_name || "",
          email: defaultUser.email || "",
          phone: defaultUser.phone || "",
        });

        setLoading(false);
        return;
      }

      setUser(userData);
      setOrganization(userData.organization);

      // Set form data
      setFormData({
        full_name: userData.full_name || "",
        email: userData.email || authUser.email || "",
        phone: userData.phone || "",
      });
    } catch (error: any) {
      console.error("Error fetching user data:", error);
      // Don't set error, just use defaults
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const defaultUser: User = {
          id: authUser.id,
          email: authUser.email || "",
          full_name: "",
          org_id: "00000000-0000-0000-0000-000000000001",
          created_at: authUser.created_at,
        };
        setUser(defaultUser);
        setFormData({
          full_name: "",
          email: authUser.email || "",
          phone: "",
        });
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

      // Try to update first
      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: formData.full_name || null,
          phone: formData.phone || null,
        })
        .eq("id", user.id);

      // If update fails because user doesn't exist, insert instead
      if (updateError && updateError.code === "PGRST116") {
        const { error: insertError } = await supabase.from("users").insert([
          {
            id: user.id,
            email: user.email,
            full_name: formData.full_name || null,
            phone: formData.phone || null,
            org_id: "00000000-0000-0000-0000-000000000001",
          },
        ]);

        if (insertError) throw insertError;
      } else if (updateError) {
        throw updateError;
      }

      // Update email through Supabase auth if changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        });

        if (emailError) throw emailError;
      }

      setSuccess(true);
      await fetchUserData();

      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setError(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new,
      });

      if (error) throw error;

      setSuccess(true);
      setPasswordData({ current: "", new: "", confirm: "" });

      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error changing password:", error);
      setError(error.message || "Failed to change password");
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

      // Try to update user record, or insert if doesn't exist
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      // If update fails because user doesn't exist, insert
      if (updateError && updateError.code === "PGRST116") {
        const { error: insertError } = await supabase.from("users").insert([
          {
            id: user.id,
            email: user.email,
            avatar_url: publicUrl,
            org_id: "00000000-0000-0000-0000-000000000001",
          },
        ]);

        if (insertError) throw insertError;
      } else if (updateError) {
        throw updateError;
      }

      // Update local state immediately
      setUser({ ...user, avatar_url: publicUrl });

      // Refresh user data
      await fetchUserData();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      setError(error.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
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
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

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
                <img
                  src={user.avatar_url}
                  alt="Profile"
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
              <Button type="submit" disabled={saving}>
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

      {/* Organization Info */}
      {organization && (
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your organization details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium">{organization.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary">
                  {organization.subscription_tier}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">
                  Member Since
                </span>
                <span className="text-sm font-medium">
                  {new Date(organization.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
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
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
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
                value={passwordData.confirm}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirm: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving || !passwordData.new || !passwordData.confirm}
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
