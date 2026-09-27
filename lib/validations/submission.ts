import { z } from "zod";
import { validateUrl, sanitizeText } from "@/lib/utils/sanitizer";

/**
 * Validates external URL field (nullable / optional).
 */
const urlField = (fieldName: string) =>
  z
    .string()
    .max(500, `${fieldName} cannot exceed 500 characters`)
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === "") return null;
      return validateUrl(val, fieldName);
    });

/**
 * Schema for creating a draft project submission.
 */
export const createSubmissionSchema = z.object({
  teamId: z.string().min(1, "Team identifier is required"),
  trackId: z.string().optional().nullable(),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title cannot exceed 150 characters")
    .transform(sanitizeText),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(10000, "Description cannot exceed 10,000 characters")
    .transform(sanitizeText),
  repositoryUrl: urlField("Repository URL"),
  demoUrl: urlField("Demo Video / URL"),
  deploymentUrl: urlField("Live Deployment URL"),
  documentationUrl: urlField("Documentation URL"),
  customData: z.record(z.unknown()).optional().nullable(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

/**
 * Schema for updating an existing draft submission.
 */
export const updateSubmissionSchema = z.object({
  trackId: z.string().optional().nullable(),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title cannot exceed 150 characters")
    .transform(sanitizeText)
    .optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(10000, "Description cannot exceed 10,000 characters")
    .transform(sanitizeText)
    .optional(),
  repositoryUrl: urlField("Repository URL"),
  demoUrl: urlField("Demo Video / URL"),
  deploymentUrl: urlField("Live Deployment URL"),
  documentationUrl: urlField("Documentation URL"),
  customData: z.record(z.unknown()).optional().nullable(),
});

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;

/**
 * Schema for query params when browsing the public gallery.
 */
export const galleryQuerySchema = z.object({
  q: z.string().max(100).optional().nullable(),
  eventId: z.string().optional().nullable(),
  trackId: z.string().optional().nullable(),
  sort: z.enum(["newest", "title_asc", "title_desc", "random"]).default("newest"),
  seed: z.coerce.number().int().optional().default(1337),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type GalleryQueryParams = z.infer<typeof galleryQuerySchema>;
