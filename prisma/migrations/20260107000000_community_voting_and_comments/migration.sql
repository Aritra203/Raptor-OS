-- CreateEnum
CREATE TYPE "VotingEligibilityMode" AS ENUM ('ALL_AUTHENTICATED', 'EVENT_PARTICIPANTS');

-- CreateEnum
CREATE TYPE "CommentModerationStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "AbuseSignalStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "AbuseSignalSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "comments" ADD COLUMN "moderation_status" "CommentModerationStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "comments" ADD COLUMN "moderated_by_id" TEXT;
ALTER TABLE "comments" ADD COLUMN "moderated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "comments_submission_id_moderation_status_created_at_idx" ON "comments"("submission_id", "moderation_status", "created_at");
CREATE INDEX "comments_event_id_moderation_status_idx" ON "comments"("event_id", "moderation_status");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "voting_configs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "voting_start" TIMESTAMP(3),
    "voting_end" TIMESTAMP(3),
    "eligibility_mode" "VotingEligibilityMode" NOT NULL DEFAULT 'EVENT_PARTICIPANTS',
    "allow_participant_votes" BOOLEAN NOT NULL DEFAULT true,
    "allow_judge_votes" BOOLEAN NOT NULL DEFAULT true,
    "allow_organizer_votes" BOOLEAN NOT NULL DEFAULT false,
    "allow_self_voting" BOOLEAN NOT NULL DEFAULT false,
    "public_vote_counts" BOOLEAN NOT NULL DEFAULT false,
    "results_published" BOOLEAN NOT NULL DEFAULT false,
    "results_published_at" TIMESTAMP(3),
    "randomize_gallery_order" BOOLEAN NOT NULL DEFAULT false,
    "gallery_random_seed" INTEGER DEFAULT 1337,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voting_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voting_configs_event_id_key" ON "voting_configs"("event_id");

-- AddForeignKey
ALTER TABLE "voting_configs" ADD CONSTRAINT "voting_configs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "abuse_signals" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "user_id" TEXT,
    "signal_type" TEXT NOT NULL,
    "severity" "AbuseSignalSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "AbuseSignalStatus" NOT NULL DEFAULT 'OPEN',
    "review_notes" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abuse_signals_event_id_status_idx" ON "abuse_signals"("event_id", "status");
CREATE INDEX "abuse_signals_user_id_idx" ON "abuse_signals"("user_id");
CREATE INDEX "abuse_signals_submission_id_idx" ON "abuse_signals"("submission_id");

-- AddForeignKey
ALTER TABLE "abuse_signals" ADD CONSTRAINT "abuse_signals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abuse_signals" ADD CONSTRAINT "abuse_signals_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "abuse_signals" ADD CONSTRAINT "abuse_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "abuse_signals" ADD CONSTRAINT "abuse_signals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
