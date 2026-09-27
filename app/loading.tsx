import { Terminal } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6"
      role="status"
      aria-label="Loading RaptorOS"
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-card border border-border shadow-lg">
          <Terminal className="h-7 w-7 text-primary animate-pulse" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-sm font-semibold tracking-wide text-foreground">
            RaptorOS
          </h2>
          <p className="text-xs text-muted-foreground">Initializing platform foundation...</p>
        </div>
      </div>
    </div>
  );
}
