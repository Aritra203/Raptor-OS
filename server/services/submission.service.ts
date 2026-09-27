import {
  submissionRepository,
  type SubmissionWithDetails,
  type UpdateDraftData,
} from "@/server/repositories/submission.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { teamRepository } from "@/server/repositories/team.repository";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors/app-error";
import type { Prisma, SubmissionState, Event } from "@prisma/client";

/**
 * Strict server-side state machine governing project submission transitions.
 */
export const LEGAL_SUBMISSION_TRANSITIONS: Record<SubmissionState, SubmissionState[]> = {
  DRAFT: ["SUBMITTED", "DISQUALIFIED"],
  SUBMITTED: ["DRAFT", "LOCKED", "DISQUALIFIED"],
  LOCKED: ["DISQUALIFIED"],
  DISQUALIFIED: ["DRAFT", "SUBMITTED", "LOCKED"],
};

export interface CreateDraftSubmissionInput {
  teamId: string;
  trackId?: string | null;
  title: string;
  description: string;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  deploymentUrl?: string | null;
  documentationUrl?: string | null;
  customData?: Record<string, unknown> | null;
}

export class SubmissionService {
  /**
   * Validates whether a state transition is legal according to the submission state machine.
   */
  private validateTransition(currentState: SubmissionState, targetState: SubmissionState) {
    const allowed = LEGAL_SUBMISSION_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new ValidationError(
        `Illegal submission state transition: '${currentState}' cannot transition to '${targetState}'. Permitted targets: [${allowed.join(", ")}].`
      );
    }
  }

  /**
   * Validates event operational state and submission deadlines.
   */
  private validateEventSubmissionWindow(event: Event, isFinalSubmit = false) {
    if (event.state === "ARCHIVED") {
      throw new ValidationError(`Cannot create or modify submissions for an archived event.`);
    }

    if (isFinalSubmit) {
      if (event.state !== "SUBMISSIONS_OPEN") {
        throw new ValidationError(
          `Submissions are not currently open for this event. Current state is '${event.state}'.`
        );
      }

      const now = new Date();
      if (event.submissionsStart && now < event.submissionsStart) {
        throw new ValidationError(
          `Project submission period has not started yet. Submissions open at ${event.submissionsStart.toISOString()}.`
        );
      }

      if (event.submissionsEnd && now > event.submissionsEnd) {
        throw new ValidationError(
          `Project submission deadline for this event has passed (${event.submissionsEnd.toISOString()}). Late submissions are rejected.`
        );
      }
    }
  }

  /**
   * Validates that track belongs to the event and is currently active.
   */
  private async validateTrack(eventId: string, trackId?: string | null) {
    if (!trackId) return;

    const track = await eventRepository.findTrackById(trackId);
    if (!track) {
      throw new NotFoundError(`Track with ID '${trackId}' was not found.`);
    }

    if (track.eventId !== eventId) {
      throw new ValidationError(
        `Cross-event track injection rejected: Track '${track.name}' does not belong to this hackathon.`
      );
    }

    if (!track.isActive) {
      throw new ValidationError(`Track '${track.name}' is inactive and cannot accept submissions.`);
    }
  }

  /**
   * Verifies user is an authorized member of the team.
   */
  private verifyTeamMembership(
    team: { members: Array<{ userId: string; role: string }> },
    userId: string
  ): { userId: string; role: string } {
    const member = team.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ForbiddenError(
        "You are not a member of this team. You cannot create or modify submissions for this team."
      );
    }
    return member;
  }

  /**
   * Creates an initial draft submission for a team in an event.
   */
  async createDraft(
    userId: string,
    eventId: string,
    input: CreateDraftSubmissionInput
  ): Promise<SubmissionWithDetails> {
    // 1. Validate event exists and submission window is open
    const event = await eventRepository.findEventById(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }
    this.validateEventSubmissionWindow(event);

    // 2. Validate team exists and belongs to the event
    const team = await teamRepository.findTeamById(input.teamId);
    if (!team) {
      throw new NotFoundError(`Team with ID '${input.teamId}' was not found.`);
    }
    if (team.eventId !== eventId) {
      throw new ValidationError("Team does not belong to the specified event.");
    }

    // 3. Verify user is in team
    this.verifyTeamMembership(team, userId);

    // 4. Enforce compound constraint: single submission per team/event
    const existing = await submissionRepository.findSubmissionByEventAndTeam(eventId, input.teamId);
    if (existing) {
      throw new ConflictError(
        "Your team already has a submission for this event. Please edit your existing submission."
      );
    }

    // 5. Validate track if provided
    await this.validateTrack(eventId, input.trackId);

    // 6. Create atomic draft and version snapshot v1
    return submissionRepository.createDraftWithVersion({
      eventId,
      teamId: input.teamId,
      creatorId: userId,
      trackId: input.trackId,
      title: input.title,
      description: input.description,
      repositoryUrl: input.repositoryUrl,
      demoUrl: input.demoUrl,
      deploymentUrl: input.deploymentUrl,
      documentationUrl: input.documentationUrl,
      customData: (input.customData as Prisma.InputJsonValue) ?? null,
    });
  }

  /**
   * Updates an existing draft submission.
   */
  async updateDraft(
    userId: string,
    submissionId: string,
    input: UpdateDraftData
  ): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    // Must be in DRAFT state to edit directly
    if (submission.state !== "DRAFT") {
      throw new ValidationError(
        `Cannot edit submission in '${submission.state}' state. Submissions must be in 'DRAFT' state to update.`
      );
    }

    // Validate event submission window
    this.validateEventSubmissionWindow(submission.event);

    // Verify user is team member
    this.verifyTeamMembership(submission.team, userId);

    // Validate track if updating
    if (input.trackId !== undefined) {
      await this.validateTrack(submission.eventId, input.trackId);
    }

    await submissionRepository.updateDraft(submissionId, input);
    return (await submissionRepository.findSubmissionById(submissionId))!;
  }

  /**
   * Finalizes and submits a project before the deadline.
   * Only the team LEADER (Captain) can submit the project.
   */
  async finalizeSubmission(userId: string, submissionId: string): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    this.validateTransition(submission.state, "SUBMITTED");
    this.validateEventSubmissionWindow(submission.event, true);

    // Verify user is team captain (LEADER)
    const member = this.verifyTeamMembership(submission.team, userId);
    if (member.role !== "LEADER") {
      throw new ForbiddenError(
        "Only the team Captain (Leader) has authority to submit the official project."
      );
    }

    // Minimum team size check
    if (submission.team.members.length < submission.event.minTeamSize) {
      throw new ValidationError(
        `Team has ${submission.team.members.length} member(s), but this event requires a minimum of ${submission.event.minTeamSize} member(s) to submit.`
      );
    }

    // Validate required fields are not empty
    if (!submission.title || submission.title.trim().length < 3) {
      throw new ValidationError("Submission title must be at least 3 characters long.");
    }
    if (!submission.description || submission.description.trim().length < 10) {
      throw new ValidationError("Submission description must be at least 10 characters long.");
    }

    return submissionRepository.finalizeSubmission(submissionId, userId);
  }

  /**
   * Reverts a SUBMITTED project back to DRAFT before the deadline to allow edits.
   */
  async unsubmitToDraft(userId: string, submissionId: string): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    this.validateTransition(submission.state, "DRAFT");
    this.validateEventSubmissionWindow(submission.event);

    const member = this.verifyTeamMembership(submission.team, userId);
    if (member.role !== "LEADER") {
      throw new ForbiddenError("Only the team Captain can revert a submission back to draft.");
    }

    return submissionRepository.transitionState(submissionId, "DRAFT", userId, {
      action: "UNSUBMITTED_TO_DRAFT",
    });
  }

  /**
   * Verifies user has event ORGANIZER or ADMIN role.
   */
  private async verifyOrganizerRole(eventId: string, userId: string) {
    const membership = await eventRepository.findMembership(userId, eventId);
    if (!membership || (membership.role !== "ORGANIZER" && membership.role !== "ADMIN")) {
      throw new ForbiddenError(
        "Only event organizers or administrators have authority to perform this action."
      );
    }
  }

  /**
   * Administrative lock: Freezes submission for evaluation.
   */
  async lockSubmission(userId: string, submissionId: string): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    await this.verifyOrganizerRole(submission.eventId, userId);
    this.validateTransition(submission.state, "LOCKED");
    return submissionRepository.transitionState(submissionId, "LOCKED", userId);
  }

  /**
   * Administrative disqualification: Disqualifies a submission with recorded reason.
   */
  async disqualifySubmission(
    userId: string,
    submissionId: string,
    reason: string
  ): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    await this.verifyOrganizerRole(submission.eventId, userId);

    if (!reason || reason.trim().length < 5) {
      throw new ValidationError("A detailed disqualification reason must be provided (min 5 characters).");
    }

    this.validateTransition(submission.state, "DISQUALIFIED");
    return submissionRepository.transitionState(submissionId, "DISQUALIFIED", userId, {
      disqualificationReason: reason.trim(),
    });
  }

  /**
   * Administrative restoration: Restores a disqualified submission.
   */
  async restoreSubmission(
    userId: string,
    submissionId: string,
    targetState: "SUBMITTED" | "LOCKED" | "DRAFT" = "SUBMITTED"
  ): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    await this.verifyOrganizerRole(submission.eventId, userId);

    if (submission.state !== "DISQUALIFIED") {
      throw new ValidationError("Only disqualified submissions can be restored.");
    }

    this.validateTransition(submission.state, targetState);
    return submissionRepository.transitionState(submissionId, targetState, userId, {
      restoredFrom: "DISQUALIFIED",
    });
  }

  /**
   * Retrieves a submission with access control (authorized team member or event organizer/admin).
   */
  async getSubmissionForUser(userId: string, submissionId: string): Promise<SubmissionWithDetails> {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    const isTeamMember = submission.team.members.some((m) => m.userId === userId);
    if (!isTeamMember) {
      // Check if user is event organizer/admin
      const organizerMembership = await eventRepository.findMembership(userId, submission.eventId);
      if (
        !organizerMembership ||
        (organizerMembership.role !== "ORGANIZER" && organizerMembership.role !== "ADMIN")
      ) {
        throw new ForbiddenError("You are not authorized to view this submission.");
      }
    }

    return submission;
  }

  /**
   * Retrieves a team's submission for an event, or null if none created.
   */
  async getSubmissionByTeamId(userId: string, teamId: string): Promise<SubmissionWithDetails | null> {
    const team = await teamRepository.findTeamById(teamId);
    if (!team) {
      throw new NotFoundError(`Team with ID '${teamId}' was not found.`);
    }

    this.verifyTeamMembership(team, userId);
    return submissionRepository.findSubmissionByTeamId(teamId);
  }

  /**
   * Lists all submissions in an event for the organizer console.
   */
  async listSubmissionsForEvent(eventId: string): Promise<SubmissionWithDetails[]> {
    return submissionRepository.listSubmissionsForEvent(eventId);
  }
}

export const submissionService = new SubmissionService();
