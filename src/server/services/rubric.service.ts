import {
  rubricRepository,
  type RubricWithDetails,
  type RubricVersionWithDetails,
} from "@/server/repositories/rubric.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { validateCriteriaWeights } from "@/lib/utils/scoring";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import type {
  CreateRubricInput,
  CreateRubricVersionInput,
} from "@/lib/validations/judging";

export class RubricService {
  /**
   * Verifies user has ORGANIZER or ADMIN role in the event.
   */
  private async verifyOrganizerRole(userId: string, eventId: string) {
    const membership = await eventRepository.findMembership(userId, eventId);
    if (!membership || membership.status !== "ACTIVE" || (membership.role !== "ORGANIZER" && membership.role !== "ADMIN")) {
      throw new ForbiddenError("Only event organizers or administrators can manage judging rubrics.");
    }
    return membership;
  }

  /**
   * Creates a new Rubric template for an event with initial version v1.
   */
  async createRubric(
    userId: string,
    eventId: string,
    input: CreateRubricInput
  ): Promise<RubricWithDetails> {
    await this.verifyOrganizerRole(userId, eventId);

    const event = await eventRepository.findEventById(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    // Validate track isolation if trackId specified
    if (input.trackId) {
      const track = await eventRepository.findTrackById(input.trackId);
      if (!track || track.eventId !== eventId) {
        throw new ValidationError("Track does not belong to the specified hackathon event.");
      }
    }

    // Validate criteria weights sum to 100% or 1.00
    validateCriteriaWeights(input.criteria);

    return rubricRepository.createRubricWithVersion({
      eventId,
      trackId: input.trackId || null,
      name: input.name,
      description: input.description || null,
      criteria: input.criteria.map((c, i) => ({
        name: c.name,
        description: c.description || null,
        weight: c.weight,
        maxScore: c.maxScore,
        order: c.order ?? i,
      })),
    });
  }

  /**
   * Retrieves all rubrics for an event.
   */
  async listEventRubrics(userId: string, eventId: string): Promise<RubricWithDetails[]> {
    const membership = await eventRepository.findMembership(userId, eventId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You must be an active participant, judge, or organizer of this event.");
    }
    return rubricRepository.findRubricsByEvent(eventId);
  }

  /**
   * Retrieves a specific rubric by ID.
   */
  async getRubric(userId: string, rubricId: string): Promise<RubricWithDetails> {
    const rubric = await rubricRepository.findRubricById(rubricId);
    if (!rubric) {
      throw new NotFoundError(`Rubric with ID '${rubricId}' was not found.`);
    }
    const membership = await eventRepository.findMembership(userId, rubric.eventId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You do not have access to this rubric.");
    }
    return rubric;
  }

  /**
   * Creates a new version for an existing rubric.
   * Preserves historical versions and their scored evidence.
   */
  async createRubricVersion(
    userId: string,
    rubricId: string,
    input: CreateRubricVersionInput,
    activate: boolean = false
  ): Promise<RubricVersionWithDetails> {
    const rubric = await rubricRepository.findRubricById(rubricId);
    if (!rubric) {
      throw new NotFoundError(`Rubric with ID '${rubricId}' was not found.`);
    }

    await this.verifyOrganizerRole(userId, rubric.eventId);

    // Validate weights of the new version
    validateCriteriaWeights(input.criteria);

    return rubricRepository.createRubricVersion(
      rubricId,
      input.criteria.map((c, i) => ({
        name: c.name,
        description: c.description || null,
        weight: c.weight,
        maxScore: c.maxScore,
        order: c.order ?? i,
      })),
      activate
    );
  }

  /**
   * Publishes a rubric version, making it the active version for judging.
   */
  async publishRubricVersion(
    userId: string,
    versionId: string
  ): Promise<RubricVersionWithDetails> {
    const version = await rubricRepository.findRubricVersionById(versionId);
    if (!version) {
      throw new NotFoundError(`Rubric version with ID '${versionId}' was not found.`);
    }

    await this.verifyOrganizerRole(userId, version.rubric.eventId);

    // Validate criteria weights before publishing
    validateCriteriaWeights(version.criteria);

    return rubricRepository.publishRubricVersion(versionId);
  }
}

export const rubricService = new RubricService();
