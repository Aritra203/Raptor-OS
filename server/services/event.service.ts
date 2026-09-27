import {
  eventRepository,
  type CreateEventInput,
  type UpdateEventInput,
  type CreateTrackInput,
  type CreatePrizeInput,
} from "@/server/repositories/event.repository";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/app-error";
import type { EventState } from "@prisma/client";

export const LEGAL_EVENT_TRANSITIONS: Record<EventState, EventState[]> = {
  DRAFT: ["REGISTRATION_OPEN", "ARCHIVED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "ARCHIVED"],
  REGISTRATION_CLOSED: ["SUBMISSIONS_OPEN", "REGISTRATION_OPEN", "ARCHIVED"],
  SUBMISSIONS_OPEN: ["SUBMISSIONS_CLOSED", "ARCHIVED"],
  SUBMISSIONS_CLOSED: ["JUDGING_OPEN", "SUBMISSIONS_OPEN", "ARCHIVED"],
  JUDGING_OPEN: ["JUDGING_CLOSED", "ARCHIVED"],
  JUDGING_CLOSED: ["RESULTS_PUBLISHED", "JUDGING_OPEN", "ARCHIVED"],
  RESULTS_PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export class EventService {
  /**
   * Validates date ordering logic for hackathon scheduling.
   */
  private validateDates(data: {
    registrationStart?: Date | null;
    registrationEnd?: Date | null;
    submissionsStart?: Date | null;
    submissionsEnd?: Date | null;
    judgingStart?: Date | null;
    judgingEnd?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }) {
    if (data.registrationStart && data.registrationEnd && data.registrationStart > data.registrationEnd) {
      throw new ValidationError("Registration start date must be before or equal to registration end date.");
    }
    if (data.submissionsStart && data.submissionsEnd && data.submissionsStart > data.submissionsEnd) {
      throw new ValidationError("Submissions start date must be before or equal to submissions end date.");
    }
    if (data.judgingStart && data.judgingEnd && data.judgingStart > data.judgingEnd) {
      throw new ValidationError("Judging start date must be before or equal to judging end date.");
    }
    if (data.startsAt && data.endsAt && data.startsAt > data.endsAt) {
      throw new ValidationError("Event start date must be before or equal to event end date.");
    }
  }

  /**
   * Validates team size boundaries.
   */
  private validateTeamSizes(min?: number, max?: number) {
    if (min !== undefined && min < 1) {
      throw new ValidationError("Minimum team size must be at least 1.");
    }
    if (max !== undefined && max < 1) {
      throw new ValidationError("Maximum team size must be at least 1.");
    }
    if (min !== undefined && max !== undefined && min > max) {
      throw new ValidationError("Minimum team size cannot exceed maximum team size.");
    }
  }

  /**
   * Normalizes and validates URL slugs.
   */
  private formatSlug(rawSlug: string): string {
    const slug = rawSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug || slug.length < 3) {
      throw new ValidationError("Slug must be at least 3 alphanumeric characters.");
    }
    return slug;
  }

  /**
   * Retrieves publicly available events for the discovery catalogue.
   */
  async getPublicEvents() {
    return eventRepository.findPublicEvents();
  }

  /**
   * Retrieves public details of an event by slug or ID.
   */
  async getPublicEventBySlug(identifier: string, allowDraft: boolean = false) {
    const event = await eventRepository.findEventBySlugOrId(identifier);
    if (!event || (!allowDraft && event.state === "DRAFT")) {
      throw new NotFoundError(`Event with identifier '${identifier}' was not found.`);
    }
    return event;
  }

  /**
   * Retrieves event by ID.
   */
  async getEventById(id: string) {
    const event = await eventRepository.findEventById(id);
    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }
    return event;
  }

  /**
   * Retrieves comprehensive event details for organizer dashboard.
   */
  async getOrganizerEvent(id: string) {
    const event = await eventRepository.findEventForOrganizer(id);
    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' was not found.`);
    }
    return event;
  }

  /**
   * Creates a new hackathon event. Creator automatically becomes event ORGANIZER.
   */
  async createEvent(input: CreateEventInput, creatorUserId: string) {
    if (!input.name || input.name.trim().length < 3) {
      throw new ValidationError("Event name must be at least 3 characters long.");
    }

    const slug = this.formatSlug(input.slug || input.name);

    // Verify slug uniqueness
    const existing = await eventRepository.findEventBySlug(slug);
    if (existing) {
      throw new ConflictError(`An event with slug '${slug}' already exists.`);
    }

    this.validateDates(input);
    this.validateTeamSizes(input.minTeamSize, input.maxTeamSize);

    return eventRepository.createEvent(
      {
        ...input,
        name: input.name.trim(),
        slug,
      },
      creatorUserId
    );
  }

  /**
   * Updates an existing event's metadata and date schedule.
   */
  async updateEvent(id: string, input: UpdateEventInput, actorId: string) {
    const current = await this.getEventById(id);

    if (current.state === "ARCHIVED") {
      throw new ValidationError("Archived events cannot be modified.");
    }

    this.validateDates(input);
    this.validateTeamSizes(
      input.minTeamSize ?? current.minTeamSize,
      input.maxTeamSize ?? current.maxTeamSize
    );

    return eventRepository.updateEvent(current.id, input, actorId);
  }

  /**
   * Governs event lifecycle state transitions through a strict server-side state machine.
   */
  async transitionEvent(id: string, targetState: EventState, actorId: string) {
    const current = await this.getEventById(id);

    if (current.state === targetState) {
      return current;
    }

    const allowedNextStates = LEGAL_EVENT_TRANSITIONS[current.state] || [];
    if (!allowedNextStates.includes(targetState)) {
      throw new ValidationError(
        `Illegal lifecycle transition: Cannot transition event from '${current.state}' to '${targetState}'. Allowed transitions: [${allowedNextStates.join(", ")}].`
      );
    }

    return eventRepository.transitionEventState(current.id, current.state, targetState, actorId);
  }

  /**
   * Creates a competition track within an event.
   */
  async createTrack(input: CreateTrackInput, actorId: string) {
    const event = await this.getEventById(input.eventId);
    if (event.state === "ARCHIVED") {
      throw new ValidationError("Cannot add tracks to an archived event.");
    }

    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError("Track name must be at least 2 characters.");
    }

    const slug = this.formatSlug(input.slug || input.name);

    // Check duplicate slug in same event
    const duplicate = event.tracks.find((t) => t.slug === slug);
    if (duplicate) {
      throw new ConflictError(`Track with slug '${slug}' already exists in this event.`);
    }

    return eventRepository.createTrack(
      {
        ...input,
        eventId: event.id,
        name: input.name.trim(),
        slug,
      },
      actorId
    );
  }

  /**
   * Updates a competition track.
   */
  async updateTrack(
    id: string,
    eventId: string,
    input: { name?: string; description?: string | null; isActive?: boolean; order?: number },
    actorId: string
  ) {
    const event = await this.getEventById(eventId);
    if (event.state === "ARCHIVED") {
      throw new ValidationError("Cannot modify tracks in an archived event.");
    }

    return eventRepository.updateTrack(id, event.id, input, actorId);
  }

  /**
   * Creates a prize for an event.
   */
  async createPrize(input: CreatePrizeInput, actorId: string) {
    const event = await this.getEventById(input.eventId);
    if (event.state === "ARCHIVED") {
      throw new ValidationError("Cannot add prizes to an archived event.");
    }

    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError("Prize name must be at least 2 characters.");
    }

    return eventRepository.createPrize(
      {
        ...input,
        eventId: event.id,
        name: input.name.trim(),
      },
      actorId
    );
  }

  /**
   * Updates a prize.
   */
  async updatePrize(
    id: string,
    eventId: string,
    input: { name?: string; description?: string | null; value?: number | null; order?: number; trackId?: string | null },
    actorId: string
  ) {
    const event = await this.getEventById(eventId);
    return eventRepository.updatePrize(id, event.id, input, actorId);
  }

  /**
   * Deletes a prize.
   */
  async deletePrize(id: string, eventId: string, actorId: string) {
    const event = await this.getEventById(eventId);
    return eventRepository.deletePrize(id, event.id, actorId);
  }
}

export const eventService = new EventService();
