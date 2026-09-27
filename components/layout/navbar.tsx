"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  Compass,
  Trophy,
  LayoutDashboard,
  FileCode,
  Scale,
  Award,
} from "lucide-react";
import { UserNav } from "@/components/auth/user-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onMenuToggle?: () => void;
  onSearchClick?: () => void;
}

const NAV_ITEMS = [
  { name: "Discover", href: "/events", icon: Compass },
  { name: "Gallery", href: "/gallery", icon: Trophy },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Submissions", href: "/dashboard/submissions", icon: FileCode },
  { name: "Judging", href: "/judge", icon: Scale },
  { name: "Verify", href: "/verify/certificate", icon: Award },
];

export function Navbar({ onMenuToggle, onSearchClick }: NavbarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-surface-1/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors lg:hidden cursor-pointer"
            aria-label="Open mobile navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
              <span className="font-bold text-xs tracking-tighter">R</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold tracking-tight text-foreground">
                RaptorOS
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline">
                v0.1
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 select-none",
                    active
                      ? "bg-surface-2 text-foreground font-semibold border border-border/60 shadow-xs"
                      : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      active ? "text-emerald-400" : "text-muted-foreground/70"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions, Search, Theme Toggle & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search (⌘K) */}
          <button
            type="button"
            onClick={onSearchClick}
            className="hidden sm:flex items-center gap-2 rounded-lg border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-foreground transition-all"
            aria-label="Open command search"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="text-xs">Search...</span>
            <kbd className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 border border-border/70">
              ⌘K
            </kbd>
          </button>

          {/* Quick Action: New Hackathon */}
          <Link
            href="/events/new"
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border/80 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Host Hackathon</span>
          </Link>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          {/* User Nav */}
          <UserNav />
        </div>
      </div>
    </header>
  );
}
