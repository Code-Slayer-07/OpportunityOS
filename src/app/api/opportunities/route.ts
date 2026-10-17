// GET /api/opportunities?type= — cached opportunities, sorted by deadline. Never calls the web. Owner: Dev B.
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/requireUser";
import { listOpportunities } from "@/lib/discovery/store";
import { z } from "zod";

const typeSchema = z.enum(["internship", "job", "hackathon", "scholarship"]);

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const rawType = new URL(request.url).searchParams.get("type");
  const type = rawType ? typeSchema.safeParse(rawType) : null;
  if (type && !type.success) return fail("Invalid type", 400);

  try {
    const opportunities = await listOpportunities(auth.supabase, type?.data);
    return ok({ count: opportunities.length, opportunities });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load opportunities", 500);
  }
}
