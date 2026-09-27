import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eventService } from "@/server/services/event.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { OrganizerDashboard } from "@/components/events/organizer-dashboard";
import { ArrowLeft, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const auth = await resolveSessionUser();
  if (!auth) {
    redirect(`/login?redirect=/events/${eventId}/manage`);
  }

  let event;
  try {
    event = await eventService.getOrganizerEvent(eventId);
  } catch {
    notFound();
  }

  const membership = auth.user.eventMemberships?.find(
    (m) => (m.eventId === event.id || m.eventId === eventId) && m.status === "ACTIVE"
  );

  if (!membership || (membership.role !== "ORGANIZER" && membership.role !== "ADMIN")) {
    redirect(`/events/${event.slug || event.id}`);
  }

  return (
    <div className="space-y-8 p-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <Link
            href={`/events/${event.slug || event.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>View Public Event</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {event.name}
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              <Shield className="h-3 w-3 mr-1" />
              <span>{membership.role} Console</span>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure event tracks, award bounties, review registered participants, and govern lifecycle transitions.
          </p>
        </div>
      </div>

      <OrganizerDashboard
        event={{
          ...event,
          prizes: event.prizes.map((p) => ({
            ...p,
            value: p.value ? Number(p.value) : null,
          })),
        }}
      />
    </div>
  );
}
