"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface TrackOption {
  id: string;
  name: string;
}

export function CreateTeamForm({
  eventId,
  eventName,
  tracks,
}: {
  eventId: string;
  eventName: string;
  tracks: TrackOption[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [trackId, setTrackId] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          trackId: trackId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create team.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto border-border bg-card/60 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-bold text-foreground">
            Form a Team for {eventName}
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Create a new team. As the creator, you will automatically be assigned as Team Captain.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-xs font-medium text-foreground mb-1">
              Team Name *
            </label>
            <input
              id="teamName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Neural Raptors"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="teamDescription" className="block text-xs font-medium text-foreground mb-1">
              Team Description / Project Focus (Optional)
            </label>
            <textarea
              id="teamDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what your team plans to build..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {tracks.length > 0 && (
            <div>
              <label htmlFor="teamTrack" className="block text-xs font-medium text-foreground mb-1">
                Preferred Track (Optional)
              </label>
              <select
                id="teamTrack"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- No specific track / Undecided --</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full gap-2 mt-4 bg-primary">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Team...</span>
              </>
            ) : (
              <>
                <span>Create Team</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
