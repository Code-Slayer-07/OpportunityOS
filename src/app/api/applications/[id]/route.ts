// PATCH, DELETE /api/applications/:id — change status / remove from shortlist. Owner: Dev A.
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { listApplicationItems } from "@/lib/applications/store";
import { requireUser } from "@/lib/auth/requireUser";
import { APPLICATION_STATUSES } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();
const patchSchema = z.object({ status: z.enum(APPLICATION_STATUSES) });

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return fail("Application not found", 404);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(`status must be one of: ${APPLICATION_STATUSES.join(", ")}`, 400);

  try {
    // Explicit ownership check on top of RLS: no row back = not yours (or doesn't exist).
    const { data, error } = await supabase
      .from("applications")
      .update({ status: body.data.status, updated_at: new Date().toISOString() })
      .eq("id", id.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("Application not found", 404);

    const [item] = await listApplicationItems(supabase, user.id, data.id);
    return ok(item);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not update", 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return fail("Application not found", 404);

  const { data, error } = await auth.supabase
    .from("applications")
    .delete()
    .eq("id", id.data)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("Application not found", 404);
  return ok({ id: data.id });
}
