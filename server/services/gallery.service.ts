import {
  submissionRepository,
  type GalleryFilterOptions,
} from "@/server/repositories/submission.repository";
import { createExcerpt } from "@/lib/utils/sanitizer";
import { NotFoundError } from "@/lib/errors/app-error";

export interface PublicSubmissionDTO {
  id: string;
  title: string;
  descriptionExcerpt: string;
  description?: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  deploymentUrl: string | null;
  documentationUrl: string | null;
  state: "SUBMITTED" | "LOCKED";
  submittedAt: string | null;
  communityVoteCount: number | null;
  event: {
    id: string;
    name: string;
    slug: string;
  };
  track: {
    id: string;
    name: string;
    slug: string;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    memberNames: string[];
  };
}

export interface PublicGalleryResult {
  items: PublicSubmissionDTO[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class GalleryService {
  /**
   * Queries the public project gallery with search, filtering, and pagination.
   * Strictly returns safe DTOs omitting private emails, user IDs, or internal tokens.
   */
  async getPublicGallery(options: GalleryFilterOptions = {}): Promise<PublicGalleryResult> {
    const { items, totalCount, page, limit, totalPages } =
      await submissionRepository.findPublicGallerySubmissions(options);

    const safeItems: PublicSubmissionDTO[] = items.map((sub) => {
      const vConfig = (sub.event as { votingConfig?: { publicVoteCounts: boolean; resultsPublished: boolean } | null })?.votingConfig;
      const isVoteVisible = vConfig?.publicVoteCounts || vConfig?.resultsPublished;

      return {
        id: sub.id,
        title: sub.title,
        descriptionExcerpt: createExcerpt(sub.description, 160),
        repositoryUrl: sub.repositoryUrl,
        demoUrl: sub.demoUrl,
        deploymentUrl: sub.deploymentUrl,
        documentationUrl: sub.documentationUrl,
        state: sub.state as "SUBMITTED" | "LOCKED",
        submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
        communityVoteCount: isVoteVisible ? (sub as { _count?: { votes: number } })._count?.votes ?? 0 : null,
        event: {
          id: sub.event.id,
          name: sub.event.name,
          slug: sub.event.slug,
        },
        track: sub.track
          ? {
              id: sub.track.id,
              name: sub.track.name,
              slug: sub.track.slug,
            }
          : null,
        team: {
          id: sub.team.id,
          name: sub.team.name,
          slug: sub.team.slug,
          memberNames: sub.team.members.map((m) => m.user.name),
        },
      };
    });

    return {
      items: safeItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Retrieves an individual public submission for detail display.
   * Rejects DRAFT or DISQUALIFIED projects with 404 NotFoundError.
   */
  async getPublicSubmission(id: string): Promise<PublicSubmissionDTO> {
    const sub = await submissionRepository.findPublicSubmissionById(id);
    if (!sub) {
      throw new NotFoundError(`Public project submission with ID '${id}' was not found.`);
    }

    const vConfig = (sub.event as { votingConfig?: { publicVoteCounts: boolean; resultsPublished: boolean } | null })?.votingConfig;
    const isVoteVisible = vConfig?.publicVoteCounts || vConfig?.resultsPublished;

    return {
      id: sub.id,
      title: sub.title,
      descriptionExcerpt: createExcerpt(sub.description, 160),
      description: sub.description,
      repositoryUrl: sub.repositoryUrl,
      demoUrl: sub.demoUrl,
      deploymentUrl: sub.deploymentUrl,
      documentationUrl: sub.documentationUrl,
      state: sub.state as "SUBMITTED" | "LOCKED",
      submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
      communityVoteCount: isVoteVisible ? (sub as { _count?: { votes: number } })._count?.votes ?? 0 : null,
      event: {
        id: sub.event.id,
        name: sub.event.name,
        slug: sub.event.slug,
      },
      track: sub.track
        ? {
            id: sub.track.id,
            name: sub.track.name,
            slug: sub.track.slug,
          }
        : null,
      team: {
        id: sub.team.id,
        name: sub.team.name,
        slug: sub.team.slug,
        memberNames: sub.team.members.map((m) => m.user.name),
      },
    };
  }
}

export const galleryService = new GalleryService();
