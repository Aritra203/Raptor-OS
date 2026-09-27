import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
}

const variantStyles = {
  default: "border-border bg-card",
  primary: "border-primary/20 bg-primary/5",
  success: "border-emerald-500/20 bg-emerald-500/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  destructive: "border-rose-500/20 bg-rose-500/5",
};

const valueStyles = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-400",
  warning: "text-amber-400",
  destructive: "text-rose-400",
};

export function StatCard({
  label,
  value,
  icon,
  description,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-all duration-150 hover:border-border/80 hover:shadow-sm",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className="text-muted-foreground/60">{icon}</div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn("text-2xl font-bold tabular-nums", valueStyles[variant])}>
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium mb-0.5",
              trend.positive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {description && (
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}
