"use client";

import * as React from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface EventAuditTrailProps {
  eventId: string;
}

export function EventAuditTrail({ eventId }: EventAuditTrailProps) {
  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/audit?limit=150`);
      if (!res.ok) {
        throw new Error(`Failed to load audit logs: ${res.statusText}`);
      }
      const data = await res.json();
      if (data?.data?.logs) {
        setLogs(data.data.logs);
      } else {
        setLogs([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit records.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopyJson = (logId: string, metadata: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopiedId(logId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q) ||
        log.actor?.name.toLowerCase().includes(q) ||
        log.actor?.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter === "ALL") return true;
      if (categoryFilter === "LIFECYCLE")
        return (
          log.action.includes("STATE") ||
          log.action.includes("EVENT") ||
          log.action.includes("REGISTRATION")
        );
      if (categoryFilter === "JUDGING")
        return (
          log.action.includes("SCORE") ||
          log.action.includes("RUBRIC") ||
          log.action.includes("JUDGE") ||
          log.action.includes("ASSIGNMENT")
        );
      if (categoryFilter === "RESULTS")
        return (
          log.action.includes("NORMALIZATION") ||
          log.action.includes("SNAPSHOT") ||
          log.action.includes("RESULTS")
        );
      if (categoryFilter === "SECURITY")
        return (
          log.action.includes("ABUSE") ||
          log.action.includes("CERTIFICATE") ||
          log.action.includes("KEY") ||
          log.action.includes("WEBHOOK")
        );

      return true;
    });
  }, [logs, search, categoryFilter]);

  const getActionBadgeColor = (action: string) => {
    if (action.includes("STATE") || action.includes("PUBLISH")) {
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
    if (action.includes("SCORE") || action.includes("RUBRIC")) {
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    }
    if (action.includes("NORMALIZATION") || action.includes("SNAPSHOT")) {
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
    if (action.includes("ABUSE") || action.includes("REVOKE") || action.includes("DISQUALIFY")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  };

  return (
    <Card className="border-border bg-card/60 backdrop-blur-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-border">
        <div>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Event Audit Trail & Governance Ledger</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Tamper-evident record of all administrative, scoring, lifecycle transitions, and security events.
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Ledger</span>
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor, or entity ID..."
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "All Events" },
              { id: "LIFECYCLE", label: "Lifecycle" },
              { id: "JUDGING", label: "Judging" },
              { id: "RESULTS", label: "Results" },
              { id: "SECURITY", label: "Security & Abuse" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer border ${
                  categoryFilter === cat.id
                    ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Log Table / List */}
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
            {error}
          </div>
        ) : loading && logs.length === 0 ? (
          <div className="space-y-2 py-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted/20" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
            No audit records match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border bg-background/50 overflow-hidden">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div key={log.id} className="transition-colors hover:bg-muted/20">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 cursor-pointer select-none"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono font-medium uppercase tracking-wide border px-2 py-0.5 shrink-0 ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </Badge>

                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {log.entityType}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate hidden md:inline">
                          ({log.entityId})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 pl-6 sm:pl-0">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="truncate max-w-[140px]">
                          {log.actor ? log.actor.name : "System Daemon"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-muted-foreground/70" />
                        <span>
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Metadata Inspector */}
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 border-t border-border/40 bg-surface-1/40 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono">Log ID: {log.id}</span>
                        {hasMetadata && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyJson(log.id, log.metadata);
                            }}
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                          >
                            {copiedId === log.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400 font-sans">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span className="font-sans">Copy JSON</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="font-mono text-[11px] text-muted-foreground">
                          Timestamp: {new Date(log.createdAt).toISOString()}
                        </div>
                        {log.actor && (
                          <div className="text-[11px] text-muted-foreground">
                            Actor: <strong className="text-foreground">{log.actor.name}</strong> ({log.actor.email})
                          </div>
                        )}
                      </div>

                      {hasMetadata ? (
                        <pre className="p-2.5 rounded-lg bg-background/90 border border-border text-[11px] font-mono text-foreground overflow-x-auto max-h-48 scrollbar-none">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No additional metadata recorded for this action.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
