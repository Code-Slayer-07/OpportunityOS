// Match pipeline shared by POST /api/match and scripts/prefetch-demo.ts. Owner: Dev C.
// Works with a user-scoped client (RLS) or the service-role client (every query filters by user_id).
import type { SupabaseClient } from "@supabase/supabase-js";
import { listOpportunities } from "@/lib/discovery/store";
import { mapPool } from "@/lib/pool";
import { matchOpportunity } from "./gemini";
import { passesGate } from "./ruleGate";
import { listUserMatches } from "./store";
import type { MatchWithOpportunity, Profile } from "@/types";

const CONCURRENCY = 3;
const FRESH_MS = 24 * 60 * 60 * 1000;

export const demoMode = () => process.env.DEMO_MODE === "true";
export const matchCacheOnly = () => process.env.MATCH_CACHE_ONLY === "true";

export interface MatchRunOptions {
  maxPerRun?: number; // default 15
  force?: boolean; // ignore the 24h freshness rule and re-score
}

export interface MatchRunResult {
  matches: MatchWithOpportunity[];
  stats: { opportunities: number; passedGate: number; matchedNow: number; fallbacks: number; cacheOnly: boolean };
}

export async function runMatching(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  { maxPerRun = 15, force = false }: MatchRunOptions = {},
): Promise<MatchRunResult> {
  // MATCH_CACHE_ONLY: serve stored matches, never call Gemini.
  if (matchCacheOnly()) {
    const matches = await listUserMatches(supabase, userId, profile);
    return { matches, stats: { opportunities: 0, passedGate: 0, matchedNow: 0, fallbacks: 0, cacheOnly: true } };
  }

  const opportunities = await listOpportunities(supabase);
  const passed = opportunities.filter((o) => passesGate(profile, o).pass);

  // Skip opportunities matched recently (cost control). DEMO_MODE treats any stored match as fresh.
  const { data: existing, error: existingError } = await supabase
    .from("matches")
    .select("opportunity_id, created_at")
    .eq("user_id", userId);
  if (existingError) throw new Error(existingError.message);
  const freshMs = demoMode() ? Infinity : FRESH_MS;
  const fresh = new Set(
    force ? [] : (existing ?? []).filter((m) => Date.now() - new Date(m.created_at).getTime() < freshMs).map((m) => m.opportunity_id),
  );
  const todo = passed.filter((o) => o.id && !fresh.has(o.id)).slice(0, maxPerRun);

  const results = await mapPool(todo, CONCURRENCY, (o) => matchOpportunity(profile, o));
  const now = new Date().toISOString();
  const rows = results.flatMap((r, i) =>
    r.status === "fulfilled"
      ? [{
          user_id: userId,
          opportunity_id: todo[i].id,
          score: r.value.score,
          reason: r.value.reason,
          evidence_map: r.value.evidenceMap,
          gaps: r.value.gaps,
          eligibility_uncertain: r.value.eligibilityUncertain,
          created_at: now,
        }]
      : [],
  );
  if (rows.length > 0) {
    const { error } = await supabase.from("matches").upsert(rows, { onConflict: "user_id,opportunity_id" });
    if (error) throw new Error(error.message);
  }

  const matches = await listUserMatches(supabase, userId, profile);
  const aiCount = results.filter((r) => r.status === "fulfilled" && r.value.source === "ai").length;
  console.log(
    `[match] opportunities=${opportunities.length} passedGate=${passed.length} matchedNow=${rows.length} ai=${aiCount} cachedFresh=${fresh.size} returned=${matches.length}`,
  );
  return {
    matches,
    stats: { opportunities: opportunities.length, passedGate: passed.length, matchedNow: rows.length, fallbacks: rows.length - aiCount, cacheOnly: false },
  };
}
