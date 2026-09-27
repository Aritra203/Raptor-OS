import * as React from "react";
import { Loader2 } from "lucide-react";

export default function PlatformLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 animate-pulse" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center space-y-3">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-card border border-border shadow-md">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold tracking-wide text-foreground">Loading...</p>
        </div>
      </div>
    </div>
  );
}
