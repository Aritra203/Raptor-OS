"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RegisterButton({
  eventId,
  isRegistered,
}: {
  eventId: string;
  isRegistered: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to register for event.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your registration for this event?")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to cancel registration.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded p-2">
          {error}
        </p>
      )}

      {isRegistered ? (
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md font-medium">
            <UserCheck className="h-4 w-4" />
            <span>Registered as Participant</span>
          </div>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-4"
          >
            {isLoading ? "Cancelling..." : "Cancel Registration"}
          </button>
        </div>
      ) : (
        <Button
          onClick={handleRegister}
          disabled={isLoading}
          className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Registering...</span>
            </>
          ) : (
            <span>Register for Hackathon</span>
          )}
        </Button>
      )}
    </div>
  );
}
