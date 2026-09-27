"use client";

import * as React from "react";
import { History, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { SubmissionVersion } from "@prisma/client";

interface SubmissionHistoryProps {
  versions: SubmissionVersion[];
}

export function SubmissionHistory({ versions }: SubmissionHistoryProps) {
  if (versions.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-bold text-foreground">
            Version History ({versions.length})
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Historical immutable snapshots captured during draft saves and final project submission.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-border/60">
          {versions.map((ver) => {
            return (
              <div key={ver.id} className="py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
                      v{ver.versionNumber}
                    </Badge>
                    <span className="font-semibold text-xs text-foreground">
                      {ver.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(ver.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {ver.description}
                </p>

                {/* Delivery links in this snapshot */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground font-mono">
                  {ver.repositoryUrl && (
                    <span className="truncate max-w-[200px]">
                      repo: {ver.repositoryUrl}
                    </span>
                  )}
                  {ver.demoUrl && (
                    <span className="truncate max-w-[200px]">
                      demo: {ver.demoUrl}
                    </span>
                  )}
                  {ver.deploymentUrl && (
                    <span className="truncate max-w-[200px]">
                      live: {ver.deploymentUrl}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
