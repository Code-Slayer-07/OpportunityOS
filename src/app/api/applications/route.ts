// GET, POST /api/applications — the user's shortlist. Owner: Dev A.
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { listApplicationItems } from "@/lib/applications/store";
import { requireUser } from "@/lib/auth/requireUser";

const createSchema = z.object({ opportunityId: z.string().uuid("Invalid opportunityId") });

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const items = await listApplicationItems(auth.supabase, auth.user.id);
    return ok({ count: items.length, applications: items });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load applications", 500);
  }
}

// Idempotent: saving the same opportunity twice returns the existing application.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  const { opportunityId } = parsed.data;

  try {
    const find = () =>
      supabase.from("applications").select("id").eq("user_id", user.id).eq("opportunity_id", opportunityId).maybeSingle();

    const first = await find();
    if (first.error) return fail(first.error.message, 500);
    let id: string | undefined = first.data?.id;
    let created = false;

    if (!id) {
      const insert = await supabase
        .from("applications")
        .insert({ user_id: user.id, opportunity_id: opportunityId, status: "Saved" })
        .select("id")
        .single();
      if (insert.error?.code === "23503") return fail("Opportunity not found", 404);
      if (insert.error?.code === "23505") {
        // Lost a race with a concurrent save: return the winner.
        id = (await find()).data?.id;
      } else if (insert.error) {
        return fail(insert.error.message, 500);
      } else {
        id = insert.data.id;
        created = true;
      }
    }

    const [item] = id ? await listApplicationItems(supabase, user.id, id) : [];
    if (!item) return fail("Could not save", 500);
    return ok(item, created ? 201 : 200);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save", 500);
  }
}
