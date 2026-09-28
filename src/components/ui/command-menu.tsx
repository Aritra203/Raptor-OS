"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  Trophy,
  LayoutDashboard,
  FileCode,
  Scale,
  Plus,
  Key,
  Award,
  ExternalLink,
  X,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  category: "Navigation" | "Actions" | "Developer";
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  shortcut?: string;
}

const DEFAULT_COMMANDS: CommandItem[] = [
  {
    id: "nav-home",
    title: "Platform Overview",
    description: "RaptorOS homepage and feature architecture",
    category: "Navigation",
    icon: Laptop,
    href: "/",
  },
  {
    id: "nav-events",
    title: "Browse Hackathons",
    description: "Explore all active, upcoming, and past events",
    category: "Navigation",
    icon: Calendar,
    href: "/events",
  },
  {
    id: "nav-gallery",
    title: "Project Gallery",
    description: "Discover submissions, code repos, and community votes",
    category: "Navigation",
    icon: Trophy,
    href: "/gallery",
  },
  {
    id: "nav-dashboard",
    title: "Participant Dashboard",
    description: "Manage registrations, teams, and submissions",
    category: "Navigation",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "nav-submissions",
    title: "Project Submissions",
    description: "Edit, review, and finalize project submissions",
    category: "Navigation",
    icon: FileCode,
    href: "/dashboard/submissions",
  },
  {
    id: "nav-judge",
    title: "Judge Portal",
    description: "Evaluate assigned submissions with rubric criteria",
    category: "Navigation",
    icon: Scale,
    href: "/judge",
  },
  {
    id: "act-create-event",
    title: "Create New Event",
    description: "Launch a new hackathon with custom tracks and prizes",
    category: "Actions",
    icon: Plus,
    href: "/events/new",
  },
  {
    id: "nav-verify-cert",
    title: "Verify Certificate",
    description: "Cryptographically verify authentic RaptorOS credentials",
    category: "Navigation",
    icon: Award,
    href: "/verify/certificate",
  },
  {
    id: "dev-account",
    title: "Developer API Keys",
    description: "Manage REST API keys, rate limits, and webhooks",
    category: "Developer",
    icon: Key,
    href: "/account",
  },
  {
    id: "dev-openapi",
    title: "OpenAPI Specification",
    description: "View standard RFC-compliant JSON schema",
    category: "Developer",
    icon: ExternalLink,
    href: "/api/v1/openapi.json",
  },
];

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Ctrl+K / Meta+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Filter commands
  const filteredCommands = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEFAULT_COMMANDS;
    return DEFAULT_COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Clamp selection index
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = React.useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      if (item.action) {
        item.action();
      } else if (item.href) {
        if (item.href.startsWith("http") || item.href.endsWith(".json")) {
          window.open(item.href, "_blank");
        } else {
          router.push(item.href);
        }
      }
    },
    [router, onOpenChange]
  );

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredCommands[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command search menu"
        className="relative z-50 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-scale-in"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-surface-1/50">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search platform..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching commands or pages found.
            </div>
          ) : (
            filteredCommands.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer select-none",
                    isSelected
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-foreground hover:bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-primary/30 bg-primary/20 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/20 border border-border/40">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground/60 bg-surface-1/40">
          <div className="flex items-center gap-2">
            <span>Navigate:</span>
            <kbd className="rounded bg-muted/40 px-1 py-0.5 text-[9px] font-mono border border-border">↑</kbd>
            <kbd className="rounded bg-muted/40 px-1 py-0.5 text-[9px] font-mono border border-border">↓</kbd>
            <span>Select:</span>
            <kbd className="rounded bg-muted/40 px-1 py-0.5 text-[9px] font-mono border border-border">↵</kbd>
          </div>
          <span>RaptorOS Command Menu</span>
        </div>
      </div>
    </div>
  );
}
