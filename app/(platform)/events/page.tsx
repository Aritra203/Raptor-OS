import * as React from "react";
import Link from "next/link";
import { eventService } from "@/server/services/event.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { Calendar, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EventDiscoveryList } from "@/components/events/event-discovery-list";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [events, auth] = await Promise.all([
    eventService.getPublicEvents(),
    resolveSessionUser(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hackathon Discovery"
        description="Discover active, upcoming, and past competitions hosted on RaptorOS."
        icon={<Calendar className="h-6 w-6" />}
        actions={
          auth ? (
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Launch Event</span>
            </Link>
          ) : undefined
        }
      />

      <EventDiscoveryList
        initialEvents={events}
        currentUserId={auth?.user.id}
      />
    </div>
  );
}
