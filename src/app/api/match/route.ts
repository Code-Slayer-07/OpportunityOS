// GET/POST /api/match — cached matches / gate + Gemini matching over cached opportunities (no web calls). Owner: Dev C.
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/requireUser";
import { listUserMatches } from "@/lib/matching/store";
import { runMatching } from "@/lib/matching/run";
import { rowToProfile } from "@/lib/profile";

export const maxDuration = 120;

// The user's cached matches (no Gemini, no web). Used for instant page loads.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { data: row, error } = await auth.supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    if (error) return fail(error.message, 500);
    const matches = row ? await listUserMatches(auth.supabase, auth.user.id, rowToProfile(row)) : [];
    return ok({ count: matches.length, matches });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load matches", 500);
  }
}

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  try {
    const { data: row, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!row?.profile_complete) return fail("Complete your profile before matching.", 400);

    const { matches, stats } = await runMatching(supabase, user.id, rowToProfile(row));
    return ok({ count: matches.length, matches, stats });
  } catch (e) {
    console.error("[match] failed:", e instanceof Error ? e.message : e);
    return fail(e instanceof Error ? e.message : "Matching failed", 500);
  }
}
