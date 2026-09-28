"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  Trophy,
  Scale,
  Settings,
  Terminal,
  FileCode,
  Zap,
  X,
  Award,
  Search,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", href: "/", icon: Terminal },
  { name: "Hackathons", href: "/events", icon: Calendar },
  { name: "Public Gallery", href: "/gallery", icon: Trophy },
  { name: "Participant Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Project Submissions", href: "/dashboard/submissions", icon: FileCode },
  { name: "Judge Portal", href: "/judge", icon: Scale },
  { name: "Verify Certificate", href: "/verify/certificate", icon: Award },
  { name: "Developer & Account", href: "/account", icon: Settings },
];

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  onSearchClick?: () => void;
}

export function MobileNav({ open, onClose, onSearchClick }: MobileNavProps) {
  const pathname = usePathname();

  // Close on route change
  React.useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface-1 border-r border-border transform transition-transform duration-300 ease-out lg:hidden flex flex-col justify-between shadow-2xl",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/10 via-blue-500/15 to-primary/10 border border-sky-500/30 p-0.5 shadow-xs">
                <Image
                  src="/logo-icon.png"
                  alt="RaptorOS Logo"
                  width={32}
                  height={32}
                  className="h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(14,165,233,0.35)]"
                />
              </div>
              <span className="text-base font-bold tracking-wider text-foreground font-pixel">
                RaptorOS
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Search Button in Drawer */}
          <div className="p-3 pb-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSearchClick?.();
              }}
              className="w-full flex items-center justify-between rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/80" />
                <span>Search platform...</span>
              </div>
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Host Hackathon Quick Action */}
          <div className="px-3 py-1">
            <Link
              href="/events/new"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 py-2 px-3 text-xs font-semibold text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Host New Hackathon</span>
            </Link>
          </div>

          {/* Nav items */}
          <nav className="p-3 space-y-0.5" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors",
                    active
                      ? "bg-surface-2 text-foreground font-semibold border border-border shadow-xs"
                      : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3.5 bg-surface-2/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground/70">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Offline-First v0.1.0</span>
            </div>
            <span className="font-mono text-[10px]">DOGFOOD 2026</span>
          </div>
        </div>
      </div>
    </>
  );
}
