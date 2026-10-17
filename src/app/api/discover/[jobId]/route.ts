// GET /api/discover/[jobId]: status and counts of a background search. Owner: Dev B.
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/requireUser";
import { getJob } from "@/lib/discovery/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const id = z.string().uuid().safeParse((await params).jobId);
  if (!id.success) return fail("Job not found", 404);
  try {
    const job = await getJob(auth.supabase, auth.user.id, id.data);
    return job ? ok(job) : fail("Job not found", 404);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load job", 500);
  }
}
