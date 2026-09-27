import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resultsService } from "@/server/services/results.service";
import {
  Trophy,
  ArrowLeft,
  Github,
  ExternalLink,
  Medal,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PublicResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  let data;
  try {
    data = await resultsService.getPublicResults(eventId);
  } catch {
    notFound();
  }

  const { event, isPublished, publishedAt, version, results } = data;

  if (!isPublished) {
    const isResultsPhase = event.state === "RESULTS_PUBLISHED";
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
          {isResultsPhase ? <Trophy className="h-8 w-8 text-amber-500" /> : <Lock className="h-8 w-8" />}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-pixel">
          {isResultsPhase ? "No Final Results Recorded" : "Results Not Yet Published"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isResultsPhase
            ? `Official results for ${event.name} have been declared, but no ranked submissions were published in the final results snapshot.`
            : `Judging evaluations and score normalizations for ${event.name} are currently in progress or undergoing organizer review. Check back once official results have been published.`}
        </p>
        <div>
          <Link
            href={`/events/${event.slug || eventId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold font-silkscreen uppercase tracking-wider text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Event Overview</span>
          </Link>
        </div>
      </div>
    );
  }

  const top3 = results.slice(0, 3);

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-6xl mx-auto">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href={`/events/${event.slug || eventId}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Event</span>
        </Link>
      </div>

      {/* Hero Header */}
      <div className="rounded-xl border border-border bg-card/60 p-6 md:p-8 space-y-3 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-400 border-amber-500/30 font-silkscreen">
                <Trophy className="h-3 w-3 mr-1" />
                <span>Official Results (v{version})</span>
              </Badge>
              {publishedAt && (
                <span className="text-xs text-muted-foreground font-silkscreen">
                  Published {new Date(publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-pixel">
              {event.name} — Winners & Placements
            </h1>
            <p className="text-xs text-muted-foreground">
              Verified, normalized final scores and award placements.
            </p>
          </div>
        </div>
      </div>

      {/* Podium Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {top3.map((item) => (
            <Card
              key={item.id}
              className={`border relative overflow-hidden ${
                item.rank === 1
                  ? "border-amber-500/40 bg-amber-500/5 shadow-md"
                  : item.rank === 2
                  ? "border-slate-400/30 bg-slate-400/5"
                  : "border-amber-700/30 bg-amber-700/5"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold font-pixel ${
                      item.rank === 1
                        ? "bg-amber-500/20 text-amber-400"
                        : item.rank === 2
                        ? "bg-slate-400/20 text-slate-300"
                        : "bg-amber-700/20 text-amber-500"
                    }`}
                  >
                    #{item.rank}
                  </span>
                  {item.prize && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 font-silkscreen">
                      🏆 {item.prize.name}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-foreground mt-2 line-clamp-1 font-pixel tracking-wide">
                  {item.submission.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Team: <span className="text-foreground font-medium">{item.submission.teamName}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.submission.description}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <span className="text-muted-foreground">
                    {item.track ? `Track: ${item.track.name}` : "General Track"}
                  </span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {item.finalScore} pts
                  </span>
                </div>
                {(item.submission.repositoryUrl || item.submission.demoUrl) && (
                  <div className="flex items-center gap-2 pt-1">
                    {item.submission.repositoryUrl && (
                      <a
                        href={item.submission.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Github className="h-3.5 w-3.5" />
                        <span>Code</span>
                      </a>
                    )}
                    {item.submission.demoUrl && (
                      <a
                        href={item.submission.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Demo</span>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Medal className="h-4 w-4 text-primary" />
            <span>Complete Official Placements ({results.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No ranked submissions recorded in this published results snapshot.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted-foreground font-silkscreen uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">Rank</th>
                  <th className="py-2.5 px-3">Project & Team</th>
                  <th className="py-2.5 px-3">Track</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-3 text-right">Award</th>
                  <th className="py-2.5 px-3 text-right">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {results.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10">
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className={item.rank <= 3 ? "text-amber-400" : "text-muted-foreground"}>
                        #{item.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-foreground block">{item.submission.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.submission.teamName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {item.track?.name || "General"}
                      {item.trackRank && (
                        <span className="text-[10px] text-primary block">#{item.trackRank} in Track</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {item.finalScore}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.prize ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          🏆 {item.prize.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {item.submission.repositoryUrl && (
                          <a
                            href={item.submission.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="Repository"
                          >
                            <Github className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {item.submission.demoUrl && (
                          <a
                            href={item.submission.demoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:text-primary/80"
                            title="Live Demo"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
