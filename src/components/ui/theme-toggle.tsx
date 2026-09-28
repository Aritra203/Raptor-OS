"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<"light" | "dark">("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("raptoros-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "dark"; // Default to dark for technical SaaS
      setTheme(initial);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("raptoros-theme", next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
  };

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-lg border border-border bg-surface-2 animate-pulse" />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 hover:bg-surface-2 text-foreground transition-all cursor-pointer ${className || ""}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
