import * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionUser } from "@/server/auth/authorization";
import { authRepository } from "@/server/repositories/auth.repository";
import { User, Shield, KeyRound, Calendar, Laptop } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AccountPage() {
  const auth = await resolveSessionUser();

  if (!auth) {
    redirect("/login?redirect=/account");
  }

  const { user } = auth;
  const sessions = await authRepository.findActiveSessionsByUserId(user.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Account & Security
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your local identity and event-scoped authorization profiles.
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* User Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{user.name}</h2>
              <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono text-foreground">{user.id}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Joined:</span>
              <span className="text-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Account Status:</span>
              <Badge variant="success" className="text-[10px] py-0 px-2">
                Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Event Memberships Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Event-Scoped Roles (RBAC)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Your permissions are partitioned by event. You possess distinct roles in each hackathon.
          </p>

          <div className="space-y-2 pt-2">
            {!user.eventMemberships || user.eventMemberships.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No active event memberships yet.
              </p>
            ) : (
              user.eventMemberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground">
                      Event: {membership.eventId.substring(0, 12)}...
                    </span>
                  </div>
                  <Badge
                    variant={
                      membership.role === "ADMIN" || membership.role === "ORGANIZER"
                        ? "default"
                        : "secondary"
                    }
                    className="text-[10px] px-2 py-0.5"
                  >
                    {membership.role}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Active Sessions
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {sessions.length} active session{sessions.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-2.5">
          {sessions.map((sess) => {
            const isCurrent = sess.id === auth.session.id;
            return (
              <div
                key={sess.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3.5 text-xs"
              >
                <div className="flex items-center gap-3">
                  <Laptop className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-foreground">
                        {sess.userAgent ? sess.userAgent.substring(0, 36) + "..." : "Standard Browser"}
                      </span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-400">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      Created: {new Date(sess.createdAt).toLocaleString()} &bull; Expires: {new Date(sess.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
