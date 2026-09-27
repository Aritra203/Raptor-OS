"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAction = async (action: "accept" | "reject") => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${invitationId}/${action}`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `Failed to ${action} invitation.`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} invitation.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => handleAction("accept")}
          disabled={isLoading}
          className="h-7 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          <span>Accept</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("reject")}
          disabled={isLoading}
          className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-3 w-3" />
          <span>Decline</span>
        </Button>
      </div>
    </div>
  );
}
