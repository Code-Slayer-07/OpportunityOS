// POST /api/discover — live discovery via TinyFish (or cached/seeded data in DEMO_MODE). Owner: Dev B.
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/requireUser";
import { discover } from "@/lib/discovery/pipeline";
import { rowToProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

// Browser-agent extraction is slow; allow the whole run to take a few minutes.
export const maxDuration = 300;

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { data: row, error } = await auth.supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!row || !row.types?.length) return fail("Complete your profile (opportunity types) before discovering.", 400);

    const { opportunities, skipped, demo } = await discover(createAdminClient(), rowToProfile(row));
    return ok({ count: opportunities.length, opportunities, skipped, demo });
  } catch (e) {
    console.error("[discover] failed:", e instanceof Error ? e.message : e);
    return fail(e instanceof Error ? e.message : "Discovery failed", 502);
  }
}
