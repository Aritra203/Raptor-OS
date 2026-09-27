import { z } from "zod";

export const votingEligibilityModeSchema = z.enum([
  "ALL_AUTHENTICATED",
  "EVENT_PARTICIPANTS",
]);

export const commentModerationStatusSchema = z.enum([
  "PUBLISHED",
  "HIDDEN",
  "REMOVED",
]);

export const abuseSignalStatusSchema = z.enum([
  "OPEN",
  "REVIEWED",
  "DISMISSED",
  "ACTIONED",
]);

export const updateVotingConfigSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    votingStart: z.coerce.date().nullable().optional(),
    votingEnd: z.coerce.date().nullable().optional(),
    eligibilityMode: votingEligibilityModeSchema.optional(),
    allowParticipantVotes: z.boolean().optional(),
    allowJudgeVotes: z.boolean().optional(),
    allowOrganizerVotes: z.boolean().optional(),
    allowSelfVoting: z.boolean().optional(),
    publicVoteCounts: z.boolean().optional(),
    resultsPublished: z.boolean().optional(),
    randomizeGalleryOrder: z.boolean().optional(),
    galleryRandomSeed: z.number().int().optional(),
  })
  .refine(
    (data) => {
      if (data.votingStart && data.votingEnd) {
        return new Date(data.votingEnd) > new Date(data.votingStart);
      }
      return true;
    },
    {
      message: "Voting end time must be chronologically after voting start time.",
      path: ["votingEnd"],
    }
  );

export type UpdateVotingConfigInput = z.infer<typeof updateVotingConfigSchema>;

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty.")
    .max(2000, "Raw comment exceeds 2000 characters limit."),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const moderateCommentSchema = z.object({
  status: commentModerationStatusSchema,
});

export type ModerateCommentInput = z.infer<typeof moderateCommentSchema>;

export const reviewAbuseSignalSchema = z.object({
  status: abuseSignalStatusSchema,
  reviewNotes: z.string().max(1000).nullable().optional(),
});

export type ReviewAbuseSignalInput = z.infer<typeof reviewAbuseSignalSchema>;

export const publishCommunityResultsSchema = z.object({
  publish: z.boolean(),
});

export type PublishCommunityResultsInput = z.infer<
  typeof publishCommunityResultsSchema
>;
