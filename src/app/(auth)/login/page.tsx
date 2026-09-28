"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: { error?: { message?: string } } | null = null;
      try {
        data = await res.json();
      } catch {
        // Fallback for non-JSON or interrupted streams
      }

      if (!res.ok) {
        throw new Error(data?.error?.message || "Invalid email or password.");
      }

      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const redirectUrl = params?.get("redirect") || "/account";
      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: Branding panel (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-surface-2 via-surface-1 to-background p-12 border-r border-border relative overflow-hidden">
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div>
          <Link href="/" className="flex items-center gap-2.5 mb-12 group select-none">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/10 via-blue-500/15 to-primary/10 border border-sky-500/30 group-hover:border-sky-400/60 p-0.5 shadow-xs transition-all">
              <Image
                src="/logo-icon.png"
                alt="RaptorOS Logo"
                width={36}
                height={36}
                className="h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(14,165,233,0.35)] group-hover:scale-105 transition-transform"
                priority
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground font-pixel">
              RaptorOS
            </span>
          </Link>
          <div className="space-y-4 max-w-md">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Run hackathons.
              <br />
              <span className="text-gradient">Not spreadsheets.</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The self-hosted platform for managing hackathons from registration to results.
              No cloud dependencies. No vendor lock-in.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <Shield className="h-3.5 w-3.5 text-emerald-500/50" />
          <span>Self-hosted · Offline-first · Open Source</span>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile brand */}
          <div className="text-center space-y-3 lg:space-y-2">
            <Link href="/" className="inline-flex items-center gap-2.5 mx-auto lg:hidden select-none">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/10 via-blue-500/15 to-primary/10 border border-sky-500/30 p-0.5 shadow-xs">
                <Image
                  src="/logo-icon.png"
                  alt="RaptorOS Logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(14,165,233,0.35)]"
                  priority
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground font-pixel">
                RaptorOS
              </span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the platform
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-400"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              loading={isLoading}
              className="w-full justify-center gap-2 mt-2"
            >
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* Register link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-primary hover:text-primary/80 transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
