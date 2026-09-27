"use client";

import * as React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandMenu } from "@/components/ui/command-menu";
import { ToastProvider } from "@/components/ui/toast";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-150 overflow-x-hidden w-full max-w-full">
        {/* Top Horizontal Navbar */}
        <Navbar
          onMenuToggle={() => setMobileNavOpen(true)}
          onSearchClick={() => setCommandMenuOpen(true)}
        />

        {/* Mobile Navigation Drawer */}
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        {/* Global Keyboard Command Menu */}
        <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 outline-none w-full max-w-full min-w-0 overflow-x-hidden"
        >
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 w-full min-w-0">
            {children}
          </div>
        </main>

        {/* Minimal Platform Footer */}
        <footer className="border-t border-border/70 bg-surface-1/40 py-6 text-xs text-muted-foreground">
          <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">RaptorOS</span>
              <span>·</span>
              <span className="font-mono text-[11px]">DOGFOOD 2026 Edition</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>100% Offline-First</span>
              </div>
              <Link href="/events" className="hover:text-foreground transition-colors">
                Hackathons
              </Link>
              <Link href="/gallery" className="hover:text-foreground transition-colors">
                Gallery
              </Link>
              <Link href="/verify/certificate" className="hover:text-foreground transition-colors">
                Verify Credential
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
