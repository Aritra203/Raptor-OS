import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "RaptorOS REST API",
      version: "1.0.0",
      description:
        "Official REST API v1 for RaptorOS — Hackathon Operating System. Fully offline-first, self-hostable, with event-scoped RBAC, signed judge records, and webhooks.",
    },
    servers: [
      {
        url: "/api/v1",
        description: "Local instance API v1 base",
      },
    ],
    components: {
      securitySchemes: {
        SessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "raptoros_session",
          description: "HttpOnly secure browser session cookie",
        },
        BearerApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "rap_live_...",
          description: "Programmatic API Key (SHA-256 hashed)",
        },
      },
    },
    paths: {
      "/auth/me": {
        get: {
          summary: "Get current user identity and memberships",
          responses: {
            200: { description: "Current user and session" },
            401: { description: "Unauthenticated" },
          },
        },
      },
      "/auth/keys": {
        get: {
          summary: "List user API keys",
          responses: { 200: { description: "API keys array" } },
        },
        post: {
          summary: "Create new API key",
          responses: { 201: { description: "Created API key with raw secret" } },
        },
      },
      "/auth/keys/{keyId}": {
        delete: {
          summary: "Revoke an API key",
          responses: { 200: { description: "Revoked API key" } },
        },
      },
      "/events": {
        get: {
          summary: "List events (paginated)",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "Paginated events" } },
        },
      },
      "/events/{eventId}": {
        get: {
          summary: "Get single event details",
          responses: {
            200: { description: "Event details" },
            404: { description: "Event not found" },
          },
        },
      },
      "/events/{eventId}/tracks": {
        get: {
          summary: "List competition tracks",
          responses: { 200: { description: "List of tracks" } },
        },
      },
      "/events/{eventId}/teams": {
        get: {
          summary: "List teams (paginated)",
          responses: { 200: { description: "List of teams" } },
        },
      },
      "/events/{eventId}/teams/{teamId}": {
        get: {
          summary: "Get single team details",
          responses: { 200: { description: "Team details" } },
        },
      },
      "/events/{eventId}/submissions": {
        get: {
          summary: "List submissions (paginated)",
          responses: { 200: { description: "List of submissions" } },
        },
      },
      "/events/{eventId}/submissions/{submissionId}": {
        get: {
          summary: "Get submission details",
          responses: { 200: { description: "Submission details" } },
        },
      },
      "/events/{eventId}/gallery": {
        get: {
          summary: "Public project gallery with deterministic seeded randomization",
          responses: { 200: { description: "Gallery submissions" } },
        },
      },
      "/events/{eventId}/judging/rubrics": {
        get: {
          summary: "List active judging rubrics and criteria",
          responses: { 200: { description: "Rubrics" } },
        },
      },
      "/events/{eventId}/judging/assignments": {
        get: {
          summary: "List judging assignments",
          responses: { 200: { description: "Assignments" } },
        },
      },
      "/events/{eventId}/judging/scores": {
        get: {
          summary: "Get judging scores",
          responses: { 200: { description: "Scores" } },
        },
        post: {
          summary: "Submit or finalize evaluation score",
          responses: { 201: { description: "Score recorded" } },
        },
      },
      "/events/{eventId}/judging/records": {
        get: {
          summary: "List signed judge records for event",
          responses: { 200: { description: "Signed records list" } },
        },
      },
      "/events/{eventId}/judging/records/verify": {
        post: {
          summary: "Cryptographically verify a signed judge evaluation record",
          responses: { 200: { description: "Verification result" } },
        },
      },
      "/events/{eventId}/results": {
        get: {
          summary: "Get published official competition results",
          responses: { 200: { description: "Official rankings" } },
        },
      },
      "/events/{eventId}/voting/config": {
        get: {
          summary: "Get voting configuration",
          responses: { 200: { description: "Voting config" } },
        },
        put: {
          summary: "Update voting configuration (Organizer only)",
          responses: { 200: { description: "Updated config" } },
        },
      },
      "/events/{eventId}/submissions/{submissionId}/vote": {
        get: { summary: "Check vote status" },
        post: { summary: "Cast community vote" },
        delete: { summary: "Retract community vote" },
      },
      "/events/{eventId}/voting/results": {
        get: { summary: "Get community choice leaderboard" },
      },
      "/events/{eventId}/submissions/{submissionId}/comments": {
        get: { summary: "Get comments feed" },
        post: { summary: "Post plain-text sanitized comment" },
      },
      "/events/{eventId}/certificates": {
        get: { summary: "List event certificates (Organizer only)" },
        post: { summary: "Issue certificate (Organizer only)" },
      },
      "/events/{eventId}/certificates/{certificateId}/revoke": {
        post: { summary: "Revoke certificate (Organizer only)" },
      },
      "/certificates/verify/{verificationCode}": {
        get: { summary: "Public certificate verification" },
      },
      "/events/{eventId}/webhooks": {
        get: { summary: "List event webhooks" },
        post: { summary: "Create webhook subscription" },
      },
      "/events/{eventId}/webhooks/{webhookId}": {
        get: { summary: "Get webhook details" },
        put: { summary: "Update webhook" },
        delete: { summary: "Delete webhook" },
      },
      "/events/{eventId}/webhooks/{webhookId}/deliveries": {
        get: { summary: "List webhook delivery logs" },
      },
      "/events/{eventId}/export/{resource}": {
        get: { summary: "Bulk export resource as CSV" },
      },
      "/events/{eventId}/import/{resource}": {
        post: { summary: "Bulk import resource from CSV" },
      },
      "/public-key": {
        get: { summary: "Get Ed25519 public verification key" },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
