import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-primary/20 text-primary border-primary/30",
    secondary: "bg-secondary text-secondary-foreground border-transparent",
    outline: "border-border text-foreground",
    success: "bg-emerald-950/80 text-emerald-400 border-emerald-800",
    warning: "bg-amber-950/80 text-amber-400 border-amber-800",
    destructive: "bg-rose-950/80 text-rose-400 border-rose-800",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
