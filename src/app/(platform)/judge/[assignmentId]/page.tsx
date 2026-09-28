import { redirect } from "next/navigation";
import { resolveSessionUser } from "@/server/auth/authorization";
import { JudgeScoringForm } from "@/components/judging/judge-scoring-form";

export const dynamic = "force-dynamic";

export default async function JudgeAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const auth = await resolveSessionUser();
  if (!auth) {
    redirect(`/login?redirect=/judge/${assignmentId}`);
  }

  return (
    <div className="p-6">
      <JudgeScoringForm assignmentId={assignmentId} />
    </div>
  );
}
