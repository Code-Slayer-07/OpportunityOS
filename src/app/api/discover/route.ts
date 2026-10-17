// POST /api/discover: start a background search and return { jobId } immediately.
// GET  /api/discover: the user's latest job (so a page reload can resume polling). Owner: Dev B.
import { after } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/requireUser";
import { createJob, getJob, runJob } from "@/lib/discovery/jobs";
import { rowToProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

// The job keeps running after the response is sent; this is its time limit (the run itself budgets 60 s of fetching).
export const maxDuration = 120;

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { data: row, error } = await auth.supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!row || !row.types?.length) return fail("Complete your profile (opportunity types) before discovering.", 400);

    const admin = createAdminClient();
    const { job, existing } = await createJob(admin, auth.user.id);
    if (existing) {
      // One running job per user: tell the client which one to follow.
      return Response.json({ error: { message: "A search is already running.", jobId: job.id } }, { status: 409 });
    }

    const profile = rowToProfile(row);
    const userId = auth.user.id;
    after(() => runJob(admin, job.id, userId, profile));
    return ok({ jobId: job.id }, 202);
  } catch (e) {
    console.error("[discover] could not start:", e instanceof Error ? e.message : e);
    return fail(e instanceof Error ? e.message : "Could not start discovery", 500);
  }
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    return ok({ job: await getJob(auth.supabase, auth.user.id) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load job", 500);
  }
}
