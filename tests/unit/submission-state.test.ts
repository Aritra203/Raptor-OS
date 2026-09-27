import { describe, it, expect } from "vitest";
import { LEGAL_SUBMISSION_TRANSITIONS } from "@/server/services/submission.service";
import { SubmissionState } from "@prisma/client";

describe("Submission State Machine (Unit Tests)", () => {
  it("allows transition from DRAFT to SUBMITTED or DISQUALIFIED, but blocks LOCKED", () => {
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.DRAFT]).toContain(SubmissionState.SUBMITTED);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.DRAFT]).toContain(SubmissionState.DISQUALIFIED);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.DRAFT]).not.toContain(SubmissionState.LOCKED);
  });

  it("allows transition from SUBMITTED to DRAFT (unsubmit), LOCKED, and DISQUALIFIED", () => {
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.SUBMITTED]).toContain(SubmissionState.DRAFT);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.SUBMITTED]).toContain(SubmissionState.LOCKED);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.SUBMITTED]).toContain(SubmissionState.DISQUALIFIED);
  });

  it("allows transition from LOCKED to DISQUALIFIED, but blocks DRAFT and SUBMITTED", () => {
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.LOCKED]).toContain(SubmissionState.DISQUALIFIED);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.LOCKED]).not.toContain(SubmissionState.DRAFT);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.LOCKED]).not.toContain(SubmissionState.SUBMITTED);
  });

  it("allows restoring DISQUALIFIED submission to SUBMITTED, LOCKED, or DRAFT", () => {
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.DISQUALIFIED]).toContain(SubmissionState.SUBMITTED);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.DISQUALIFIED]).toContain(SubmissionState.LOCKED);
    expect(LEGAL_SUBMISSION_TRANSITIONS[SubmissionState.DISQUALIFIED]).toContain(SubmissionState.DRAFT);
  });
});
