import { registrationRepository } from "@/server/repositories/registration.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";

export class RegistrationService {
  /**
   * Registers an authenticated user as a PARTICIPANT in an event.
   * Enforces server-side event state and registration deadline checks.
   */
  async registerForEvent(userId: string, eventId: string) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID or slug '${eventId}' does not exist.`);
    }

    // 1. Verify event lifecycle permits registration
    if (event.state !== "REGISTRATION_OPEN") {
      throw new ValidationError(
        `Registration is not currently open for this event (current status: ${event.state}).`
      );
    }

    // 2. Server-side deadline enforcement
    const now = new Date();
    if (event.registrationEnd && now > event.registrationEnd) {
      throw new ValidationError("The registration deadline for this event has passed.");
    }
    if (event.registrationStart && now < event.registrationStart) {
      throw new ValidationError("Registration has not opened yet.");
    }

    // 3. Verify user is not already registered in this event
    const existing = await registrationRepository.findMembership(userId, event.id);
    if (existing) {
      if (existing.status === "ACTIVE") {
        throw new ConflictError("You are already registered for this event.");
      }
      // If inactive or suspended, reactivate
      return registrationRepository.updateMembershipStatus(existing.id, "ACTIVE", userId);
    }

    return registrationRepository.createMembership(userId, event.id, "PARTICIPANT");
  }

  /**
   * Cancels a user's registration if the event state permits.
   */
  async cancelRegistration(userId: string, eventId: string) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID or slug '${eventId}' does not exist.`);
    }

    const membership = await registrationRepository.findActiveParticipant(userId, event.id);
    if (!membership) {
      throw new NotFoundError("You do not have an active registration for this event.");
    }

    // Lifecycle check: Cannot cancel if submissions have started or event is archived
    if (
      event.state === "SUBMISSIONS_OPEN" ||
      event.state === "SUBMISSIONS_CLOSED" ||
      event.state === "JUDGING_OPEN" ||
      event.state === "JUDGING_CLOSED" ||
      event.state === "RESULTS_PUBLISHED" ||
      event.state === "ARCHIVED"
    ) {
      throw new ValidationError(
        "Registration cannot be cancelled once the competition phase has begun."
      );
    }

    // Check if user is in a team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: { eventId: event.id },
      },
      include: {
        team: {
          include: {
            submission: true,
          },
        },
      },
    });

    if (teamMember) {
      if (teamMember.team.submission) {
        throw new ValidationError("Cannot cancel registration while your team has an active project submission.");
      }
      // Remove user from team before cancelling membership
      await prisma.teamMember.delete({ where: { id: teamMember.id } });
    }

    await registrationRepository.deleteMembership(membership.id, userId, event.id);
    return { success: true, message: "Registration cancelled successfully." };
  }

  /**
   * Checks whether a user is registered for a specific event.
   */
  async getRegistration(userId: string, eventId: string) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) return null;
    return registrationRepository.findMembership(userId, event.id);
  }

  /**
   * Lists all participants for an event (organizer access).
   */
  async listParticipants(eventId: string) {
    return registrationRepository.listEventParticipants(eventId);
  }

  /**
   * Lists all events a user has registered for (participant dashboard).
   */
  async listUserRegistrations(userId: string) {
    return registrationRepository.listUserRegistrations(userId);
  }
}

export const registrationService = new RegistrationService();
