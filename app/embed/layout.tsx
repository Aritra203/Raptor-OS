import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RaptorOS Embedded Gallery",
  description: "Self-hosted embeddable project gallery for RaptorOS hackathons.",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-4 antialiased">
      {children}
    </div>
  );
}
