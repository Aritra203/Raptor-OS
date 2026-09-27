import { describe, it, expect } from "vitest";
import { LEGAL_EVENT_TRANSITIONS } from "@/server/services/event.service";
import type { EventState } from "@prisma/client";

describe("Event Lifecycle State Machine Unit Tests (Phase 4)", () => {
  it("allows DRAFT to transition only to REGISTRATION_OPEN or ARCHIVED", () => {
    const allowed = LEGAL_EVENT_TRANSITIONS.DRAFT;
    expect(allowed).toContain("REGISTRATION_OPEN");
    expect(allowed).toContain("ARCHIVED");
    expect(allowed).not.toContain("SUBMISSIONS_OPEN");
    expect(allowed).not.toContain("JUDGING_OPEN");
    expect(allowed).not.toContain("RESULTS_PUBLISHED");
  });

  it("allows REGISTRATION_OPEN to transition to REGISTRATION_CLOSED or ARCHIVED", () => {
    const allowed = LEGAL_EVENT_TRANSITIONS.REGISTRATION_OPEN;
    expect(allowed).toContain("REGISTRATION_CLOSED");
    expect(allowed).toContain("ARCHIVED");
    expect(allowed).not.toContain("JUDGING_OPEN");
  });

  it("allows REGISTRATION_CLOSED to transition to SUBMISSIONS_OPEN, REGISTRATION_OPEN, or ARCHIVED", () => {
    const allowed = LEGAL_EVENT_TRANSITIONS.REGISTRATION_CLOSED;
    expect(allowed).toContain("SUBMISSIONS_OPEN");
    expect(allowed).toContain("REGISTRATION_OPEN");
    expect(allowed).toContain("ARCHIVED");
  });

  it("allows SUBMISSIONS_OPEN to transition only to SUBMISSIONS_CLOSED or ARCHIVED", () => {
    const allowed = LEGAL_EVENT_TRANSITIONS.SUBMISSIONS_OPEN;
    expect(allowed).toContain("SUBMISSIONS_CLOSED");
    expect(allowed).toContain("ARCHIVED");
    expect(allowed).not.toContain("DRAFT");
  });

  it("treats ARCHIVED as a terminal state with zero transitions", () => {
    const allowed = LEGAL_EVENT_TRANSITIONS.ARCHIVED;
    expect(allowed).toEqual([]);
    expect(allowed.length).toBe(0);
  });

  it("verifies every state in EventState enum is defined in transition map", () => {
    const states: EventState[] = [
      "DRAFT",
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "SUBMISSIONS_OPEN",
      "SUBMISSIONS_CLOSED",
      "JUDGING_OPEN",
      "JUDGING_CLOSED",
      "RESULTS_PUBLISHED",
      "ARCHIVED",
    ];

    for (const state of states) {
      expect(LEGAL_EVENT_TRANSITIONS[state]).toBeDefined();
      expect(Array.isArray(LEGAL_EVENT_TRANSITIONS[state])).toBe(true);
    }
  });
});
