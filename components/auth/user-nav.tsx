"use client";

import * as React from "react";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  eventMemberships?: Array<{ role: string }>;
}

export function UserNav() {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.authenticated && data?.data?.user) {
          setUser(data.data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-7 w-20 animate-pulse rounded bg-muted/20" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 sm:px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Log In</span>
        </Link>
        <Link
          href="/register"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Register</span>
        </Link>
      </div>
    );
  }

  const primaryRole = user.eventMemberships?.[0]?.role;

  return (
    <div className="flex items-center gap-3 shrink-0">
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1 text-xs text-foreground hover:bg-muted/60 transition-colors"
        title="View Account & Sessions"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
        </div>
        <span className="font-medium max-w-[120px] truncate">{user.name}</span>
        {primaryRole && (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
            {primaryRole}
          </span>
        )}
      </Link>

      <LogoutButton />
    </div>
  );
}
