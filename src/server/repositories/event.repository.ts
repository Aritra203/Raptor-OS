import { prisma } from "@/lib/db/prisma";
import { Prisma, type Event, type EventState, type Track, type Prize } from "@prisma/client";

export interface CreateEventInput {
  name: string;
  slug: string;
  description?: string | null;
  location?: string | null;
  isVirtual?: boolean;
  timezone?: string;
  registrationStart?: Date | null;
  registrationEnd?: Date | null;
  submissionsStart?: Date | null;
  submissionsEnd?: Date | null;
  judgingStart?: Date | null;
  judgingEnd?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  minTeamSize?: number;
  maxTeamSize?: number;
}

export interface UpdateEventInput {
  name?: string;
  description?: string | null;
  location?: string | null;
  isVirtual?: boolean;
  timezone?: string;
  registrationStart?: Date | null;
  registrationEnd?: Date | null;
  submissionsStart?: Date | null;
  submissionsEnd?: Date | null;
  judgingStart?: Date | null;
  judgingEnd?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  minTeamSize?: number;
  maxTeamSize?: number;
}

export interface CreateTrackInput {
  eventId: string;
  name: string;
  slug: string;
  description?: string | null;
  order?: number;
}

export interface CreatePrizeInput {
  eventId: string;
  trackId?: string | null;
  name: string;
  description?: string | null;
  value?: Prisma.Decimal | number | null;
  order?: number;
}

export class EventRepository {
  /**
   * Lists publicly visible events (excludes DRAFT events from public discovery).
   */
  async findPublicEvents() {
    return prisma.event.findMany({
      where: {
        state: { not: "DRAFT" },
      },
      include: {
        tracks: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
        prizes: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            memberships: { where: { role: "PARTICIPANT", status: "ACTIVE" } },
            teams: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Finds a public event by its slug or ID, including active tracks and prizes.
   */
  async findEventBySlugOrId(identifier: string) {
    return prisma.event.findFirst({
      where: {
        OR: [{ slug: identifier }, { id: identifier }],
      },
      include: {
        tracks: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
        prizes: {
          orderBy: { order: "asc" },
          include: {
            track: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            memberships: { where: { role: "PARTICIPANT", status: "ACTIVE" } },
            teams: true,
          },
        },
      },
    });
  }

  /**
   * Finds a public event by its slug, including active tracks and prizes.
   */
  async findEventBySlug(slug: string) {
    return prisma.event.findUnique({
      where: { slug },
      include: {
        tracks: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
        prizes: {
          orderBy: { order: "asc" },
          include: {
            track: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            memberships: { where: { role: "PARTICIPANT", status: "ACTIVE" } },
            teams: true,
          },
        },
      },
    });
  }

  /**
   * Finds an event by its ID.
   */
  async findEventById(id: string) {
    return prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        tracks: { orderBy: { order: "asc" } },
        prizes: { orderBy: { order: "asc" } },
        _count: {
          select: {
            memberships: true,
            teams: true,
            submissions: true,
          },
        },
      },
    });
  }

  /**
   * Finds detailed event information for organizer management console.
   */
  async findEventForOrganizer(id: string) {
    return prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        tracks: { orderBy: { order: "asc" } },
        prizes: {
          orderBy: { order: "asc" },
          include: { track: true },
        },
        teams: {
          include: {
            creator: { select: { id: true, name: true, email: true } },
            track: { select: { id: true, name: true } },
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        submissions: {
          include: {
            team: { select: { id: true, name: true, slug: true } },
            track: { select: { id: true, name: true } },
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        _count: {
          select: {
            memberships: true,
            teams: true,
            submissions: true,
          },
        },
      },
    });
  }

  /**
   * Creates an event and assigns the creator as an event ORGANIZER in an atomic transaction.
   */
  async createEvent(input: CreateEventInput, creatorUserId: string): Promise<Event> {
    return prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          location: input.location,
          isVirtual: input.isVirtual ?? true,
          timezone: input.timezone || "UTC",
          state: "DRAFT",
          registrationStart: input.registrationStart,
          registrationEnd: input.registrationEnd,
          submissionsStart: input.submissionsStart,
          submissionsEnd: input.submissionsEnd,
          judgingStart: input.judgingStart,
          judgingEnd: input.judgingEnd,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          minTeamSize: input.minTeamSize ?? 1,
          maxTeamSize: input.maxTeamSize ?? 4,
        },
      });

      // Assign creator as event ORGANIZER
      await tx.eventMembership.create({
        data: {
          userId: creatorUserId,
          eventId: event.id,
          role: "ORGANIZER",
          status: "ACTIVE",
        },
      });

      // Audit log event creation
      await tx.auditLog.create({
        data: {
          actorId: creatorUserId,
          eventId: event.id,
          action: "EVENT_CREATED",
          entityType: "Event",
          entityId: event.id,
          metadata: {
            slug: event.slug,
            name: event.name,
          },
        },
      });

      return event;
    });
  }

  /**
   * Updates an existing event's properties.
   */
  async updateEvent(id: string, input: UpdateEventInput, actorId: string): Promise<Event> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.location !== undefined && { location: input.location }),
          ...(input.isVirtual !== undefined && { isVirtual: input.isVirtual }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.registrationStart !== undefined && { registrationStart: input.registrationStart }),
          ...(input.registrationEnd !== undefined && { registrationEnd: input.registrationEnd }),
          ...(input.submissionsStart !== undefined && { submissionsStart: input.submissionsStart }),
          ...(input.submissionsEnd !== undefined && { submissionsEnd: input.submissionsEnd }),
          ...(input.judgingStart !== undefined && { judgingStart: input.judgingStart }),
          ...(input.judgingEnd !== undefined && { judgingEnd: input.judgingEnd }),
          ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
          ...(input.endsAt !== undefined && { endsAt: input.endsAt }),
          ...(input.minTeamSize !== undefined && { minTeamSize: input.minTeamSize }),
          ...(input.maxTeamSize !== undefined && { maxTeamSize: input.maxTeamSize }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId: id,
          action: "EVENT_UPDATED",
          entityType: "Event",
          entityId: id,
          metadata: {
            updatedFields: Object.keys(input),
          },
        },
      });

      return updated;
    });
  }

  /**
   * Updates an event's lifecycle state with audit logging.
   */
  async transitionEventState(
    id: string,
    previousState: EventState,
    newState: EventState,
    actorId: string
  ): Promise<Event> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id },
        data: { state: newState },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId: id,
          action: "EVENT_LIFECYCLE_TRANSITION",
          entityType: "Event",
          entityId: id,
          metadata: {
            from: previousState,
            to: newState,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Creates a competition track for an event.
   */
  async createTrack(input: CreateTrackInput, actorId: string): Promise<Track> {
    return prisma.$transaction(async (tx) => {
      const track = await tx.track.create({
        data: {
          eventId: input.eventId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          order: input.order ?? 0,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId: input.eventId,
          action: "TRACK_CREATED",
          entityType: "Track",
          entityId: track.id,
          metadata: {
            name: track.name,
            slug: track.slug,
          },
        },
      });

      return track;
    });
  }

  /**
   * Updates a competition track.
   */
  async updateTrack(
    id: string,
    eventId: string,
    input: { name?: string; description?: string | null; isActive?: boolean; order?: number },
    actorId: string
  ): Promise<Track> {
    return prisma.$transaction(async (tx) => {
      const track = await tx.track.update({
        where: { id },
        data: input,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "TRACK_UPDATED",
          entityType: "Track",
          entityId: track.id,
          metadata: input,
        },
      });

      return track;
    });
  }

  /**
   * Finds a competition track by its ID.
   */
  async findTrackById(id: string): Promise<Track | null> {
    return prisma.track.findUnique({
      where: { id },
    });
  }

  /**
   * Finds an event membership for a user in an event.
   */
  async findMembership(userId: string, eventId: string) {
    return prisma.eventMembership.findFirst({
      where: { userId, eventId, status: "ACTIVE" },
    });
  }

  /**
   * Creates an award / prize for an event.
   */
  async createPrize(input: CreatePrizeInput, actorId: string): Promise<Prize> {
    return prisma.$transaction(async (tx) => {
      const prize = await tx.prize.create({
        data: {
          eventId: input.eventId,
          trackId: input.trackId || null,
          name: input.name,
          description: input.description,
          value: input.value !== undefined && input.value !== null ? new Prisma.Decimal(input.value) : null,
          order: input.order ?? 0,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId: input.eventId,
          action: "PRIZE_CREATED",
          entityType: "Prize",
          entityId: prize.id,
          metadata: {
            name: prize.name,
          },
        },
      });

      return prize;
    });
  }

  /**
   * Updates a prize.
   */
  async updatePrize(
    id: string,
    eventId: string,
    input: { name?: string; description?: string | null; value?: Prisma.Decimal | number | null; order?: number; trackId?: string | null },
    actorId: string
  ): Promise<Prize> {
    return prisma.$transaction(async (tx) => {
      const prize = await tx.prize.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.trackId !== undefined && { trackId: input.trackId }),
          ...(input.value !== undefined && {
            value: input.value !== null ? new Prisma.Decimal(input.value) : null,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "PRIZE_UPDATED",
          entityType: "Prize",
          entityId: prize.id,
        },
      });

      return prize;
    });
  }

  /**
   * Deletes a prize.
   */
  async deletePrize(id: string, eventId: string, actorId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.prize.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "PRIZE_DELETED",
          entityType: "Prize",
          entityId: id,
        },
      });
    });
  }
}

export const eventRepository = new EventRepository();
