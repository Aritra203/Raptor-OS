import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionUser } from "@/server/auth/authorization";
import { CreateEventForm } from "@/components/events/create-event-form";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const auth = await resolveSessionUser();
  if (!auth) {
    redirect("/login?redirect=/events/new");
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl mx-auto">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Events</span>
      </Link>

      <CreateEventForm />
    </div>
  );
}
