"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [isVirtual, setIsVirtual] = React.useState(true);
  const [timezone, setTimezone] = React.useState("UTC");
  const [registrationStart, setRegistrationStart] = React.useState("");
  const [registrationEnd, setRegistrationEnd] = React.useState("");
  const [submissionsStart, setSubmissionsStart] = React.useState("");
  const [submissionsEnd, setSubmissionsEnd] = React.useState("");
  const [judgingStart, setJudgingStart] = React.useState("");
  const [judgingEnd, setJudgingEnd] = React.useState("");
  const [minTeamSize, setMinTeamSize] = React.useState(1);
  const [maxTeamSize, setMaxTeamSize] = React.useState(4);

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          location: isVirtual ? "Online / Virtual" : location,
          isVirtual,
          timezone,
          registrationStart: registrationStart || undefined,
          registrationEnd: registrationEnd || undefined,
          submissionsStart: submissionsStart || undefined,
          submissionsEnd: submissionsEnd || undefined,
          judgingStart: judgingStart || undefined,
          judgingEnd: judgingEnd || undefined,
          minTeamSize: Number(minTeamSize),
          maxTeamSize: Number(maxTeamSize),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create event.");
      }

      router.push(`/events/${data.data.id}/manage`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto border-border bg-card/60 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-bold text-foreground">
            Create a New Hackathon
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Define event parameters, team limits, and schedule. You will be assigned as the event Organizer.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border/60 pb-2">
              General Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eventName" className="block text-xs font-medium text-foreground mb-1">
                  Event Name *
                </label>
                <input
                  id="eventName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. RaptorHacks 2026"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="eventSlug" className="block text-xs font-medium text-foreground mb-1">
                  URL Slug *
                </label>
                <input
                  id="eventSlug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="raptorhacks-2026"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="eventDesc" className="block text-xs font-medium text-foreground mb-1">
                Description
              </label>
              <textarea
                id="eventDesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overview of the hackathon theme, goals, and rules..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Format
                </label>
                <select
                  value={isVirtual ? "virtual" : "inperson"}
                  onChange={(e) => setIsVirtual(e.target.value === "virtual")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="virtual">Virtual / Online</option>
                  <option value="inperson">In-Person Venue</option>
                </select>
              </div>

              {!isVirtual && (
                <div>
                  <label htmlFor="eventLocation" className="block text-xs font-medium text-foreground mb-1">
                    Venue Location
                  </label>
                  <input
                    id="eventLocation"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Hall A, Tech Campus"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div>
                <label htmlFor="eventTimezone" className="block text-xs font-medium text-foreground mb-1">
                  Timezone
                </label>
                <input
                  id="eventTimezone"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Team Rules */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border/60 pb-2">
              Team Size Limits
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minTeamSize" className="block text-xs font-medium text-foreground mb-1">
                  Min Team Size
                </label>
                <input
                  id="minTeamSize"
                  type="number"
                  min={1}
                  max={20}
                  value={minTeamSize}
                  onChange={(e) => setMinTeamSize(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="maxTeamSize" className="block text-xs font-medium text-foreground mb-1">
                  Max Team Size
                </label>
                <input
                  id="maxTeamSize"
                  type="number"
                  min={1}
                  max={20}
                  value={maxTeamSize}
                  onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Timeline & Deadlines */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border/60 pb-2">
              Schedule & Deadlines
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="regStart" className="block text-xs font-medium text-foreground mb-1">
                  Registration Opens
                </label>
                <input
                  id="regStart"
                  type="datetime-local"
                  value={registrationStart}
                  onChange={(e) => setRegistrationStart(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="regEnd" className="block text-xs font-medium text-foreground mb-1">
                  Registration Closes
                </label>
                <input
                  id="regEnd"
                  type="datetime-local"
                  value={registrationEnd}
                  onChange={(e) => setRegistrationEnd(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="subStart" className="block text-xs font-medium text-foreground mb-1">
                  Submissions Open
                </label>
                <input
                  id="subStart"
                  type="datetime-local"
                  value={submissionsStart}
                  onChange={(e) => setSubmissionsStart(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="subEnd" className="block text-xs font-medium text-foreground mb-1">
                  Submissions Close
                </label>
                <input
                  id="subEnd"
                  type="datetime-local"
                  value={submissionsEnd}
                  onChange={(e) => setSubmissionsEnd(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="judgeStart" className="block text-xs font-medium text-foreground mb-1">
                  Judging Starts
                </label>
                <input
                  id="judgeStart"
                  type="datetime-local"
                  value={judgingStart}
                  onChange={(e) => setJudgingStart(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="judgeEnd" className="block text-xs font-medium text-foreground mb-1">
                  Judging Ends
                </label>
                <input
                  id="judgeEnd"
                  type="datetime-local"
                  value={judgingEnd}
                  onChange={(e) => setJudgingEnd(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full gap-2 bg-primary">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Event...</span>
              </>
            ) : (
              <>
                <span>Create & Configure Event</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
