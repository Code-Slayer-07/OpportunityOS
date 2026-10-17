// Read a user's cached matches joined with their opportunities. Owner: Dev C.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromRow, isShowable } from "@/lib/discovery/store";
import { passesGate } from "@/lib/matching/ruleGate";
import type { MatchWithOpportunity, Profile } from "@/types";

// Best score first; drops matches whose opportunity no longer passes the gate (e.g. deadline passed).
export async function listUserMatches(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
): Promise<MatchWithOpportunity[]> {
  const { data, error } = await supabase.from("matches").select("*, opportunities(*)").eq("user_id", userId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((m) => m.opportunities)
    .map((m) => ({
      id: m.id,
      opportunityId: m.opportunity_id,
      score: m.score,
      reason: m.reason ?? "",
      evidenceMap: m.evidence_map ?? [],
      gaps: m.gaps ?? [],
      eligibilityUncertain: m.eligibility_uncertain,
      createdAt: m.created_at,
      opportunity: fromRow(m.opportunities),
      isFallback: !!m.is_fallback, // rows from before fallbacks stopped being saved; never treated as fresh
    }))
    .filter((m) => isShowable(m.opportunity) && passesGate(profile, m.opportunity).pass)
    .sort((a, b) => b.score - a.score);
}
