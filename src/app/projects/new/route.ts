import { NextRequest } from "next/server";
import { POST as handlePost } from "@/app/api/submissions/submit/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handlePost(req);
}
