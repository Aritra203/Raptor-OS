"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 w-full min-w-0">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 xl:gap-5 min-w-0 shrink-0">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors lg:hidden cursor-pointer shrink-0"
            aria-label="Open mobile navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 select-none">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/10 via-blue-500/15 to-primary/10 border border-sky-500/30 group-hover:border-sky-400/60 p-0.5 shadow-xs transition-all duration-200 shrink-0">
              <Image
                src="/logo-icon.png"
                alt="RaptorOS Logo"
                width={32}
                height={32}
                className="h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(14,165,233,0.35)] group-hover:scale-110 transition-transform duration-200"
                priority
              />
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-base font-bold tracking-wider text-foreground font-pixel whitespace-nowrap">
                RaptorOS
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline whitespace-nowrap">
                v0.1
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 min-w-0" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150 select-none whitespace-nowrap",
                    active
                      ? "bg-surface-2 text-foreground font-semibold border border-border shadow-xs"
                      : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors shrink-0",
                      active ? "text-primary" : "text-muted-foreground/70"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions, Search, Theme Toggle & User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Search (⌘K) - Hidden on mobile, accessible in mobile drawer */}
          <button
            type="button"
            onClick={onSearchClick}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-foreground transition-all shrink-0"
            aria-label="Open command search"
            title="Search... (⌘K)"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="hidden 2xl:inline text-xs">Search...</span>
            <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 border border-border/70">
              ⌘K
            </kbd>
          </button>

          {/* Quick Action: New Hackathon */}
          <Link
            href="/events/new"
            className="hidden 2xl:inline-flex items-center gap-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border/80 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
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
