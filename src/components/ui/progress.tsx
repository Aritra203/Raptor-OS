import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  size = "md",
  variant = "default",
  className,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const barColors = {
    default: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    destructive: "bg-rose-500",
  };

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
          {showValue && (
            <span className="text-xs font-mono font-medium text-foreground">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden rounded-full bg-muted/40", sizeClasses[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            barColors[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
