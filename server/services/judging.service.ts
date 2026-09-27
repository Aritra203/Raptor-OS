import { judgingRepository } from "@/server/repositories/judging.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { ForbiddenError, NotFoundError } from "@/lib/errors/app-error";

export class JudgingService {
  /**
   * Verifies user has ORGANIZER or ADMIN role in the event.
   */
  private async verifyOrganizerRole(userId: string, eventId: string) {
    const membership = await eventRepository.findMembership(userId, eventId);
    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      (membership.role !== "ORGANIZER" && membership.role !== "ADMIN")
    ) {
      throw new ForbiddenError("Only event organizers or administrators can access judging administration.");
    }
    return membership;
  }

  /**
   * Retrieves real-time event judging progress metrics for organizers.
   */
  async getEventJudgingProgress(userId: string, eventId: string) {
    await this.verifyOrganizerRole(userId, eventId);
    const event = await eventRepository.findEventById(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    return judgingRepository.getJudgingProgress(eventId);
  }

  /**
   * Retrieves dashboard overview for an authenticated judge across all their events.
   */
  async getJudgeDashboard(userId: string, eventId?: string) {
    const assignments = await judgingRepository.findJudgeAssignments(userId, eventId);

    const total = assignments.length;
    const completed = assignments.filter((a) => a.status === "COMPLETED").length;
    const inProgress = assignments.filter((a) => a.status === "IN_PROGRESS").length;
    const pending = assignments.filter((a) => a.status === "PENDING").length;

    // Group assignments by event
    const eventMap = new Map<string, { event: (typeof assignments)[0]["event"]; assignments: typeof assignments }>();
    for (const a of assignments) {
      if (!eventMap.has(a.eventId)) {
        eventMap.set(a.eventId, { event: a.event, assignments: [] });
      }
      eventMap.get(a.eventId)!.assignments.push(a);
    }

    return {
      stats: {
        total,
        completed,
        inProgress,
        pending,
        completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
      },
      events: Array.from(eventMap.values()),
      assignments,
    };
  }
}

export const judgingService = new JudgingService();
