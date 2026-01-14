"use client";

import { useState, useEffect } from "react";
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
  Users,
  UserPlus,
  Mail,
  Loader2,
  Crown,
  X,
  Copy,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface TeamInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface TeamData {
  organization: { name: string; tier: string };
  members: TeamMember[];
  invites: TeamInvite[];
  limits: { used: number; limit: number; unlimited: boolean };
  currentUser: { id: string; role: string };
}

export function TeamManagement() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      const response = await fetch("/api/team/invites");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch team data");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSending(true);

    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.upgradeRequired) {
          setShowUpgrade(true);
          return;
        }
        throw new Error(result.error || result.message || "Failed to send invite");
      }

      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      setLastInviteUrl(result.inviteUrl);
      fetchTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/team/invites?id=${inviteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to cancel invite");
      }

      fetchTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invite");
    }
  };

  const copyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      setError("Failed to copy invite link");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <p>Unable to load team data</p>
        </CardContent>
      </Card>
    );
  }

  const isAtLimit = !data.limits.unlimited && data.limits.used >= data.limits.limit;
  const totalPending = data.invites.length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Manage your team and invite new members
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {data.limits.used} / {data.limits.unlimited ? "∞" : data.limits.limit}
              </p>
              <p className="text-xs text-muted-foreground">team members</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              {success}
              {lastInviteUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7"
                  onClick={() => copyInviteUrl(lastInviteUrl)}
                >
                  {copiedUrl === lastInviteUrl ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Copy Link
                </Button>
              )}
            </div>
          )}

          {/* Invite Form */}
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={sending || isAtLimit}
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                className="h-10 px-3 rounded-md border bg-background text-sm"
                disabled={sending || isAtLimit}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={sending || isAtLimit || !inviteEmail}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite
                  </>
                )}
              </Button>
            </div>
            {isAtLimit && (
              <p className="text-xs text-amber-600">
                You&apos;ve reached your team member limit. Upgrade to invite more members.
              </p>
            )}
          </form>

          {/* Pending Invites */}
          {data.invites.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Invites ({totalPending})
              </h4>
              <div className="space-y-2">
                {data.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">
                        {invite.role}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Members List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Active Members ({data.members.length})
            </h4>
            <div className="space-y-2">
              {data.members.map((member) => {
                const isCurrentUser = member.id === data.currentUser.id;
                const isAdmin = member.role === "admin";

                return (
                  <div
                    key={member.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      isCurrentUser && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                          isAdmin ? "bg-primary/10 text-primary" : "bg-muted"
                        )}
                      >
                        {member.full_name?.[0]?.toUpperCase() ||
                          member.email[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          {member.full_name || member.email}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          <Crown className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                      {!isAdmin && (
                        <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">
                          Member
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        type="users"
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        currentCount={data.limits.used}
        limit={data.limits.limit}
      />
    </>
  );
}
