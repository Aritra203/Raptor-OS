"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Check, Loader2, AlertCircle, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CommunityVotingWidgetProps {
  eventId: string;
  submissionId: string;
  initialVoteCount: number | null;
}

interface VotingConfig {
  isEnabled: boolean;
  votingStart: string | null;
  votingEnd: string | null;
  publicVoteCounts: boolean;
  resultsPublished: boolean;
  allowSelfVoting: boolean;
}

export function CommunityVotingWidget({
  eventId,
  submissionId,
  initialVoteCount,
}: CommunityVotingWidgetProps) {
  const [config, setConfig] = React.useState<VotingConfig | null>(null);
  const [hasVoted, setHasVoted] = React.useState<boolean>(false);
  const [voteCount, setVoteCount] = React.useState<number | null>(initialVoteCount);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadVotingStatus() {
      setIsLoading(true);
      try {
        const [configRes, voteRes, meRes] = await Promise.all([
          fetch(`/api/events/${eventId}/voting/config`),
          fetch(`/api/events/${eventId}/submissions/${submissionId}/vote`),
          fetch(`/api/v1/auth/me`),
        ]);

        if (isMounted) {
          if (configRes.ok) {
            const configData = await configRes.json();
            setConfig(configData.config);
          }

          if (voteRes.ok) {
            const voteData = await voteRes.json();
            setHasVoted(Boolean(voteData.hasVoted));
          }

          if (meRes.ok) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch {
        // Fallback silently if offline or unauthenticated
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadVotingStatus();
    return () => {
      isMounted = false;
    };
  }, [eventId, submissionId]);

  const handleVote = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/events/${eventId}/submissions/${submissionId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (res.status === 401) {
        const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to cast vote.");
      }

      setHasVoted(true);
      setIsAuthenticated(true);
      if (voteCount !== null) {
        setVoteCount(voteCount + 1);
      }
      setSuccessMessage("Your community vote has been recorded!");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Voting failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetract = async () => {
    if (!confirm("Are you sure you want to retract your vote for this project?")) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/events/${eventId}/submissions/${submissionId}/vote`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to retract vote.");
      }

      setHasVoted(false);
      if (voteCount !== null && voteCount > 0) {
        setVoteCount(voteCount - 1);
      }
      setSuccessMessage("Your vote was retracted.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Retraction failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card/60">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // If voting is completely disabled for this event
  if (config && !config.isEnabled) {
    return (
      <Card className="border-border bg-card/60 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-bold text-foreground">
              Community Voting
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
            Disabled
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Community voting is currently not active for this hackathon.
          </p>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const isBeforeWindow =
    config?.votingStart && now < new Date(config.votingStart);
  const isAfterWindow = config?.votingEnd && now > new Date(config.votingEnd);
  const isWindowActive = !isBeforeWindow && !isAfterWindow;

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <Card className="border-border bg-card/60 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={`h-4 w-4 ${hasVoted ? "fill-rose-500 text-rose-500" : "text-rose-500"}`} />
          <CardTitle className="text-sm font-bold text-foreground">
            Community Choice
          </CardTitle>
        </div>
        {voteCount !== null ? (
          <Badge variant="outline" className="text-xs font-mono bg-rose-500/10 text-rose-400 border-rose-500/20">
            {voteCount} {voteCount === 1 ? "vote" : "votes"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border flex items-center gap-1">
            <EyeOff className="h-3 w-3" />
            <span>Hidden</span>
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {errorMessage && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {errorMessage.toLowerCase().includes("participant") && (
              <Link
                href={`/events/${eventId}`}
                className="text-[11px] underline underline-offset-2 text-primary font-medium hover:text-primary/80"
              >
                Go to Hackathon Page to Register
              </Link>
            )}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-400 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {!isWindowActive ? (
          <p className="text-xs text-muted-foreground italic">
            {isBeforeWindow
              ? `Voting opens on ${new Date(config!.votingStart!).toLocaleDateString()}`
              : "Community voting has concluded for this event."}
          </p>
        ) : !isAuthenticated ? (
          <Link
            href={`/login?redirect=${encodeURIComponent(currentPath)}`}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white py-2 text-xs font-semibold transition-all shadow-sm shadow-rose-600/20 active:scale-[0.98]"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign in to Vote</span>
          </Link>
        ) : hasVoted ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <Check className="h-4 w-4" />
              <span>You voted for this project</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetract}
              disabled={isSubmitting}
              className="w-full text-xs text-muted-foreground hover:text-destructive border-border"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              <span>Retract Vote</span>
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleVote}
            disabled={isSubmitting}
            className="w-full text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white gap-1.5 shadow-sm shadow-rose-600/20 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className="h-3.5 w-3.5 fill-white" />
            )}
            <span>Vote for Project</span>
          </Button>
        )}

        <p className="text-[11px] text-muted-foreground leading-normal">
          {config?.publicVoteCounts || config?.resultsPublished
            ? "Votes represent community favorites and are calculated separately from judge scoring."
            : "Vote counts are hidden until organizers publish official community results."}
        </p>
      </CardContent>
    </Card>
  );
}
