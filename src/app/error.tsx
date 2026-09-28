"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Client-side non-sensitive logging
    console.error("Platform caught runtime error:", error.message);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center"
      role="alert"
    >
      <div className="mx-auto max-w-md space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="h-7 w-7 text-rose-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. The application remains isolated and secure.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground/60">
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Return to Overview</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
