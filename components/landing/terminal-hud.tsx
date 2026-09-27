"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalTab {
  id: string;
  name: string;
  command: string;
  output: Array<{
    text: string;
    type?: "info" | "success" | "warning" | "code" | "dim";
  }>;
}

const TABS: TerminalTab[] = [
  {
    id: "status",
    name: "01_event_telemetry.sh",
    command: "raptor telemetry --event sample-hack-2026",
    output: [
      { text: "Connecting to local ledger [raptoros:5432] ...", type: "dim" },
      { text: "✔ Event: Sample Hack 2026 [JUDGING_OPEN]", type: "success" },
      { text: "✔ Verified Registrations: 92 Builders across 41 Teams", type: "info" },
      { text: "✔ Active Tracks: 8 (Developer Tools, AI Agents, Climate...)", type: "info" },
      { text: "✔ Evaluation Matrix: 41/41 submissions assigned", type: "info" },
      { text: "✔ Double-blind peer isolation: ENFORCED", type: "success" },
      { text: "⚡ Statistical Z-Score normalization ready", type: "warning" },
    ],
  },
  {
    id: "submit",
    name: "02_ship_project.sh",
    command: "raptor submit --team 'IronLedger' --track 'Health'",
    output: [
      { text: "Validating submission deliverables...", type: "dim" },
      { text: "✔ Repository: github.com/hackers/iron-ledger (Verified)", type: "success" },
      { text: "✔ Live Demo: iron-ledger.raptor.local (200 OK)", type: "success" },
      { text: "✔ Artifact SHA-256: 0x8f2a91bc74e2d83b...", type: "code" },
      { text: "✔ Snapshot locked into immutable version v1.0", type: "success" },
      { text: "★ Deliverable successfully staged for judge calibration", type: "info" },
    ],
  },
  {
    id: "judge",
    name: "03_peer_scoring.sh",
    command: "raptor judge --evaluator clara --submission prj_09",
    output: [
      { text: "Loading multi-criteria rubric: Tech (40%), UX (30%), Impact (30%)", type: "dim" },
      { text: "Evaluating: Technical Depth [10/10] — Flawless offline architecture", type: "info" },
      { text: "Evaluating: Innovation & Polish [9/10] — High developer utility", type: "info" },
      { text: "✔ Calculated Raw Score: 95.00 / 100", type: "success" },
      { text: "✔ Peer-isolation: Evaluator Clara cannot view peer scores", type: "warning" },
      { text: "✔ Cryptographic proof logged to audit ledger", type: "success" },
    ],
  },
];

export function TerminalHud() {
  const [activeTabId, setActiveTabId] = React.useState("status");
  const [copied, setCopied] = React.useState(false);

  const activeTab: TerminalTab = TABS.find((t) => t.id === activeTabId) ?? TABS[0]!;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeTab.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-2xl border border-border/80 bg-surface-1/90 backdrop-blur-xl shadow-2xl overflow-hidden text-left group">
      {/* Glow highlight */}
      <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-surface-2/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground/80 pl-2 hidden sm:inline">
            raptoros-runtime — v0.1.0-dogfood
          </span>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-surface-0/60 p-0.5 rounded-lg border border-border/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono rounded-md transition-all cursor-pointer",
                activeTabId === tab.id
                  ? "bg-emerald-500/15 text-emerald-400 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 sm:p-6 font-mono text-xs space-y-3 min-h-[220px]">
        {/* Command line */}
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5 text-foreground/90">
          <div className="flex items-center gap-2 truncate">
            <span className="text-emerald-400 font-bold select-none">$</span>
            <span className="text-emerald-300 font-semibold truncate">{activeTab.command}</span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 bg-surface-2/60 hover:bg-surface-2 px-2 py-1 rounded cursor-pointer"
            title="Copy command"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className="font-sans">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Output stream */}
        <div className="space-y-1.5 pt-1">
          {activeTab.output.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2 leading-relaxed animate-fade-in",
                line.type === "success" && "text-emerald-400 font-medium",
                line.type === "info" && "text-sky-300",
                line.type === "warning" && "text-amber-300",
                line.type === "code" && "text-purple-300 font-mono",
                line.type === "dim" && "text-muted-foreground/60 italic",
                !line.type && "text-foreground/80"
              )}
            >
              <span>{line.text}</span>
            </div>
          ))}
        </div>

        {/* Blinking prompt line */}
        <div className="pt-2 flex items-center gap-2 text-muted-foreground/60">
          <span className="text-emerald-400 font-bold">$</span>
          <span className="h-3.5 w-2 bg-emerald-400/80 animate-pulse inline-block" />
        </div>
      </div>
    </div>
  );
}
