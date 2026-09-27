-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "normalization_runs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "normalization_runs" ADD COLUMN "input_score_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "normalization_runs" ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "normalization_runs_event_id_version_key" ON "normalization_runs"("event_id", "version");

-- AlterTable
ALTER TABLE "normalized_scores" ADD COLUMN "judge_id" TEXT;
ALTER TABLE "normalized_scores" ADD COLUMN "assignment_id" TEXT;
ALTER TABLE "normalized_scores" ADD COLUMN "score_id" TEXT;
ALTER TABLE "normalized_scores" ADD COLUMN "raw_score" DECIMAL(7,4);
ALTER TABLE "normalized_scores" ADD COLUMN "calibration_data" JSONB;

-- DropIndex
DROP INDEX IF EXISTS "normalized_scores_normalization_run_id_submission_id_key";

-- CreateIndex
CREATE INDEX "normalized_scores_judge_id_idx" ON "normalized_scores"("judge_id");

-- AddForeignKey
ALTER TABLE "normalized_scores" ADD CONSTRAINT "normalized_scores_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "normalized_scores" ADD CONSTRAINT "normalized_scores_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "judge_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "normalized_scores" ADD CONSTRAINT "normalized_scores_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "result_snapshots" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "normalization_run_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "finalized_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "result_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "result_snapshots_event_id_version_key" ON "result_snapshots"("event_id", "version");
CREATE INDEX "result_snapshots_event_id_status_idx" ON "result_snapshots"("event_id", "status");

-- AddForeignKey
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_normalization_run_id_fkey" FOREIGN KEY ("normalization_run_id") REFERENCES "normalization_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "project_results" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "track_id" TEXT,
    "prize_id" TEXT,
    "rank" INTEGER NOT NULL,
    "track_rank" INTEGER,
    "raw_aggregate_score" DECIMAL(7,4) NOT NULL,
    "normalized_score" DECIMAL(7,4),
    "final_score" DECIMAL(7,4) NOT NULL,
    "score_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_results_snapshot_id_submission_id_key" ON "project_results"("snapshot_id", "submission_id");
CREATE INDEX "project_results_snapshot_id_rank_idx" ON "project_results"("snapshot_id", "rank");

-- AddForeignKey
ALTER TABLE "project_results" ADD CONSTRAINT "project_results_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "result_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_results" ADD CONSTRAINT "project_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_results" ADD CONSTRAINT "project_results_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_results" ADD CONSTRAINT "project_results_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "prizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
