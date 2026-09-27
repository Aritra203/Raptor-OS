"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, LogOut, Trash2, Mail, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface TeamMemberData {
  id: string;
  userId: string;
  role: "LEADER" | "MEMBER";
  joinedAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface TeamInvitationData {
  id: string;
  email: string;
  status: string;
  expiresAt: Date | string;
}

interface TeamDetails {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  description: string | null;
  trackId: string | null;
  track?: { id: string; name: string } | null;
  members: TeamMemberData[];
  invitations: TeamInvitationData[];
  event: {
    id: string;
    name: string;
    maxTeamSize: number;
    minTeamSize: number;
  };
}

export function TeamManager({
  team,
  currentUserId,
}: {
  team: TeamDetails;
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [isInviting, setIsInviting] = React.useState(false);
  const [isLeaving, setIsLeaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const isLeader = team.members.some((m) => m.userId === currentUserId && m.role === "LEADER");
  const canInvite = team.members.length < team.event.maxTeamSize;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/teams/${team.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to send invitation.");
      }

      setSuccess(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!confirm("Are you sure you want to leave this team?")) return;

    setIsLeaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${team.id}/leave`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to leave team.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave team.");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) return;

    setError(null);

    try {
      const res = await fetch(`/api/teams/${team.id}/members/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to remove member.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400">
          {success}
        </div>
      )}

      {/* Team Roster Card */}
      <Card className="border-border bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold text-foreground">
                {team.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {team.members.length} / {team.event.maxTeamSize} team members &bull; Min required: {team.event.minTeamSize}
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveTeam}
            disabled={isLeaving}
            className="text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            {isLeaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            <span>Leave Team</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Member List */}
          <div className="divide-y divide-border/60">
            {team.members.map((member) => (
              <div
                key={member.id}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    {member.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {member.user.name}
                      </span>
                      {member.role === "LEADER" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20"
                        >
                          <Crown className="h-2.5 w-2.5" />
                          <span>Captain</span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {member.user.email}
                    </span>
                  </div>
                </div>

                {/* Remove member button for captain */}
                {isLeader && member.userId !== currentUserId && (
                  <button
                    onClick={() => handleRemoveMember(member.userId, member.user.name)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Remove member from team"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Invitation Section */}
          <div className="border-t border-border/80 pt-6 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>Invite New Team Member</span>
            </h4>

            {canInvite ? (
              <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-2 max-w-md">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="participant@raptoros.internal"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isInviting}
                  className="text-xs gap-1.5 shrink-0 bg-primary"
                >
                  {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  <span>Send Invite</span>
                </Button>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Team has reached its maximum size of {team.event.maxTeamSize} members. No additional invitations can be sent.
              </p>
            )}

            {/* Pending Invitations list */}
            {team.invitations.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs text-muted-foreground font-medium block">
                  Invitations Sent ({team.invitations.length}):
                </span>
                <div className="space-y-1.5 text-xs">
                  {team.invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between bg-muted/20 border border-border/40 px-3 py-1.5 rounded-md"
                    >
                      <span className="font-mono text-muted-foreground">{inv.email}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {inv.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
