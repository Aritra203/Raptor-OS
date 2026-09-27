import { describe, it, expect } from "vitest";
import { validateCriteriaWeights } from "@/lib/utils/scoring";
import {
  createRubricSchema,
  createRubricVersionSchema,
  saveScoreDraftSchema,
  finalizeScoreSchema,
} from "@/lib/validations/judging";
import { ValidationError } from "@/lib/errors/app-error";

describe("Rubric Validation & Scoring Utilities", () => {
  describe("validateCriteriaWeights", () => {
    it("accepts criteria weights summing to 100", () => {
      const criteria = [
        { weight: 40 },
        { weight: 30 },
        { weight: 30 },
      ];
      expect(() => validateCriteriaWeights(criteria)).not.toThrow();
    });

    it("accepts criteria weights summing to 1.00", () => {
      const criteria = [
        { weight: 0.4 },
        { weight: 0.3 },
        { weight: 0.3 },
      ];
      expect(() => validateCriteriaWeights(criteria)).not.toThrow();
    });

    it("rejects criteria weights summing to less than 100 (e.g. 90)", () => {
      const criteria = [
        { weight: 40 },
        { weight: 30 },
        { weight: 20 },
      ];
      expect(() => validateCriteriaWeights(criteria)).toThrow(ValidationError);
    });

    it("rejects criteria weights summing to more than 100 (e.g. 110)", () => {
      const criteria = [
        { weight: 50 },
        { weight: 30 },
        { weight: 30 },
      ];
      expect(() => validateCriteriaWeights(criteria)).toThrow(ValidationError);
    });

    it("rejects empty criteria list", () => {
      expect(() => validateCriteriaWeights([])).toThrow(ValidationError);
    });
  });

  describe("Zod Schemas", () => {
    it("validates createRubricSchema correctly", () => {
      const valid = {
        name: "Standard Rubric",
        description: "Official evaluation criteria",
        criteria: [
          { name: "Code Quality", weight: 50, maxScore: 10, order: 0 },
          { name: "Innovation", weight: 50, maxScore: 10, order: 1 },
        ],
      };
      const result = createRubricSchema.parse(valid);
      expect(result.name).toBe("Standard Rubric");
      expect(result.criteria).toHaveLength(2);
    });

    it("rejects createRubricSchema with short name or empty criteria", () => {
      expect(() =>
        createRubricSchema.parse({
          name: "R",
          criteria: [],
        })
      ).toThrow();
    });

    it("validates createRubricVersionSchema with criteria", () => {
      const valid = {
        criteria: [
          { name: "Completeness", weight: 100, maxScore: 20, order: 0 },
        ],
      };
      const result = createRubricVersionSchema.parse(valid);
      expect(result.criteria[0]?.weight).toBe(100);
      expect(result.criteria[0]?.maxScore).toBe(20);
    });

    it("allows empty items in saveScoreDraftSchema", () => {
      const draft = saveScoreDraftSchema.parse({
        feedback: "Work in progress",
        items: [],
      });
      expect(draft.feedback).toBe("Work in progress");
      expect(draft.items).toEqual([]);
    });

    it("requires at least one item in finalizeScoreSchema", () => {
      expect(() =>
        finalizeScoreSchema.parse({
          feedback: "Finished",
          items: [],
        })
      ).toThrow();
    });
  });
});
