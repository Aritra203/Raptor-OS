"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalTab {
  id: string;
  name: string;
  shortName: string;
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
    shortName: "telemetry",
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
    shortName: "ship",
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
    shortName: "scoring",
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
    <div className="relative rounded-xl border border-zinc-300 dark:border-zinc-800/80 bg-[#0d0e15] text-zinc-100 shadow-lg overflow-hidden text-left w-full max-w-full min-w-0">
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#13151f] px-3 sm:px-4 py-2 gap-2 w-full min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90 inline-block" />
          </div>
          <span className="text-[11px] font-mono text-zinc-400 pl-2 hidden md:inline">
            raptoros-runtime — v0.1.0-dogfood
          </span>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-zinc-800 overflow-x-auto max-w-full min-w-0 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-mono rounded transition-all cursor-pointer whitespace-nowrap shrink-0",
                activeTabId === tab.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <span className="hidden sm:inline">{tab.name}</span>
              <span className="sm:hidden">{tab.shortName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-3 sm:p-5 font-mono text-xs space-y-2.5 min-h-[190px] w-full min-w-0 overflow-hidden">
        {/* Command line */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 text-zinc-100 min-w-0">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="text-amber-400 font-bold select-none shrink-0">$</span>
            <span className="text-zinc-100 font-semibold truncate text-[11px] sm:text-xs">{activeTab.command}</span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-100 transition-colors shrink-0 bg-zinc-800/60 hover:bg-zinc-800 px-2 py-1 rounded cursor-pointer"
            title="Copy command"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied</span>
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
        <div className="space-y-1 pt-1 text-[11px] sm:text-[11.5px] overflow-x-auto scrollbar-none w-full min-w-0">
          {activeTab.output.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2 leading-relaxed animate-fade-in break-words",
                line.type === "success" && "text-emerald-400 font-medium",
                line.type === "info" && "text-sky-300",
                line.type === "warning" && "text-amber-300",
                line.type === "code" && "text-purple-300 font-mono",
                line.type === "dim" && "text-zinc-500 italic",
                !line.type && "text-zinc-300"
              )}
            >
              <span className="break-words">{line.text}</span>
            </div>
          ))}
        </div>

        {/* Blinking prompt line */}
        <div className="pt-1.5 flex items-center gap-2 text-zinc-500">
          <span className="text-amber-400 font-bold">$</span>
          <span className="h-3.5 w-2 bg-amber-400/90 animate-pulse inline-block" />
        </div>
      </div>
    </div>
  );
}
