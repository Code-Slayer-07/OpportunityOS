// applications table access (user-scoped client, RLS applies). Owner: Dev A.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromRow } from "@/lib/discovery/store";
import { sortByPriority } from "@/lib/scoring/priority";
import type { Application, ApplicationItem } from "@/types";
import { toApplicationItem } from "./item";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toApplication = (r: Row): Application => ({
  id: r.id,
  opportunityId: r.opportunity_id,
  status: r.status,
  savedAt: r.saved_at,
  updatedAt: r.updated_at,
});

// Applications for the user, joined with opportunity and match, sorted by priority (passed last).
// Pass `id` to fetch a single one. The explicit user_id filter is defence in depth on top of RLS.
export async function listApplicationItems(supabase: SupabaseClient, userId: string, id?: string): Promise<ApplicationItem[]> {
  let query = supabase.from("applications").select("*, opportunities(*)").eq("user_id", userId);
  if (id) query = query.eq("id", id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r) => r.opportunities);

  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("opportunity_id, score, reason")
    .eq("user_id", userId)
    .in("opportunity_id", rows.map((r) => r.opportunity_id));
  if (matchError) throw new Error(matchError.message);
  const byOpp = new Map((matches ?? []).map((m) => [m.opportunity_id, { score: m.score, reason: m.reason ?? "" }]));

  const now = new Date();
  return sortByPriority(
    rows.map((r) => toApplicationItem(toApplication(r), fromRow(r.opportunities), byOpp.get(r.opportunity_id) ?? null, now)),
  );
}
