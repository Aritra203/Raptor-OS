import * as React from "react";
import { Loader2 } from "lucide-react";

export default function EventDetailLoading() {
  return (
    <div className="space-y-8 pb-16 animate-pulse">
      {/* Hero Banner Skeleton */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-6 w-28 rounded-full bg-muted/60" />
              <div className="h-6 w-32 rounded-full bg-muted/40" />
            </div>
            <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-muted/50" />
            <div className="h-4 w-full max-w-xl rounded-md bg-muted/30" />
            <div className="h-4 w-2/3 max-w-md rounded-md bg-muted/30" />
          </div>
          <div className="flex flex-col gap-3 lg:w-64 pt-2">
            <div className="h-12 w-full rounded-xl bg-primary/20 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-semibold text-primary">Loading hackathon...</span>
            </div>
          </div>
        </div>

        {/* Quick Numbers Bar Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/40 pt-6 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/20 border border-border/30" />
          ))}
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-6">
        <div className="h-12 w-96 rounded-xl bg-muted/30 border border-border/40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 rounded-2xl bg-card/40 border border-border/40" />
            <div className="h-36 rounded-2xl bg-card/40 border border-border/40" />
          </div>
          <div className="space-y-4">
            <div className="h-64 rounded-2xl bg-card/40 border border-border/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
