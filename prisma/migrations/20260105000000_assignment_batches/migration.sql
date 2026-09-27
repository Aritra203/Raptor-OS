-- CreateTable
CREATE TABLE "assignment_batches" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'DETERMINISTIC_BALANCED',
    "target_coverage" INTEGER NOT NULL,
    "submission_count" INTEGER NOT NULL,
    "judge_count" INTEGER NOT NULL,
    "assignment_count" INTEGER NOT NULL,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignment_batches_event_id_idx" ON "assignment_batches"("event_id");

-- AddForeignKey
ALTER TABLE "assignment_batches" ADD CONSTRAINT "assignment_batches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_batches" ADD CONSTRAINT "assignment_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judge_assignments" ADD CONSTRAINT "judge_assignments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "assignment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
