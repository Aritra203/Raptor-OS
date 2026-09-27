import * as React from "react";
import { cn } from "@/lib/utils";

type EventStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "SUBMISSIONS_OPEN"
  | "SUBMISSIONS_CLOSED"
  | "JUDGING_OPEN"
  | "JUDGING_CLOSED"
  | "RESULTS_PUBLISHED"
  | "ARCHIVED";

const statusConfig: Record<
  EventStatus,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: "Draft",
    dot: "bg-gray-400",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/20",
  },
  REGISTRATION_OPEN: {
    label: "Registration Open",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  REGISTRATION_CLOSED: {
    label: "Registration Closed",
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  SUBMISSIONS_OPEN: {
    label: "Submissions Open",
    dot: "bg-blue-400",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  SUBMISSIONS_CLOSED: {
    label: "Submissions Closed",
    dot: "bg-orange-400",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  JUDGING_OPEN: {
    label: "Judging in Progress",
    dot: "bg-violet-400",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/20",
  },
  JUDGING_CLOSED: {
    label: "Judging Complete",
    dot: "bg-indigo-400",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
  },
  RESULTS_PUBLISHED: {
    label: "Results Published",
    dot: "bg-primary",
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  ARCHIVED: {
    label: "Archived",
    dot: "bg-muted-foreground",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "sm",
  showDot = true,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status as EventStatus] || {
    label: status.replace(/_/g, " "),
    dot: "bg-muted-foreground",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    border: "border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bg,
        config.text,
        config.border,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
      )}
      {config.label}
    </span>
  );
}
