// Match pipeline shared by POST /api/match, scripts and the demo prescorer. Owner: Dev C.
// Works with a user-scoped client (RLS) or the service-role client (every query filters by user_id).
//
// Rules:
// - Only real Gemini results are ever saved. A rule-based fallback is shown (labelled isFallback) but never persisted,
//   so it can never be mistaken for a fresh AI match later.
// - DEMO_MODE makes zero external calls: stored AI matches are served, and any opportunity without one gets an instant,
//   transient rule-based card.
// - MATCH_CACHE_ONLY serves stored AI matches only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { listOpportunities } from "@/lib/discovery/store";
import { mapPool } from "@/lib/pool";
import type { MatchWithOpportunity, Opportunity, Profile } from "@/types";
import { ruleBasedMatch } from "./fallback";
import { BATCH_SIZE, matchBatch, type Scored } from "./gemini";
import { passesGate } from "./ruleGate";
import { listUserMatches } from "./store";

const CONCURRENCY = 3;
const FRESH_MS = 24 * 60 * 60 * 1000;

export const demoMode = () => process.env.DEMO_MODE === "true";
export const matchCacheOnly = () => process.env.MATCH_CACHE_ONLY === "true";

export interface MatchRunOptions {
  maxPerRun?: number; // default 15
  force?: boolean; // ignore the 24h freshness rule and re-score
  /** Scripts only: score with Gemini even when DEMO_MODE / MATCH_CACHE_ONLY are set (that is what prescoring is for). */
  live?: boolean;
}

export interface MatchRunResult {
  matches: MatchWithOpportunity[];
  stats: { opportunities: number; passedGate: number; matchedNow: number; fallbacks: number; cacheOnly: boolean; demo: boolean };
}

const byScore = (a: MatchWithOpportunity, b: MatchWithOpportunity) => b.score - a.score;

/** An instant, never-saved rule-based card. */
export function transientMatch(profile: Profile, o: Opportunity, now = new Date()): MatchWithOpportunity {
  return {
    ...ruleBasedMatch(profile, o, now),
    id: `transient-${o.id}`,
    opportunityId: o.id!,
    createdAt: now.toISOString(),
    opportunity: o,
    isFallback: true,
  };
}

/** Stored AI matches, plus (DEMO_MODE only) instant transient cards for opportunities without one. Zero external calls. */
export async function loadMatches(supabase: SupabaseClient, userId: string, profile: Profile): Promise<MatchWithOpportunity[]> {
  const stored = await listUserMatches(supabase, userId, profile);
  if (!demoMode()) return stored;
  const storedAi = stored.filter((m) => !m.isFallback);
  const have = new Set(storedAi.map((m) => m.opportunityId));
  const opportunities = await listOpportunities(supabase);
  const transient = opportunities.filter((o) => o.id && !have.has(o.id) && passesGate(profile, o).pass).map((o) => transientMatch(profile, o));
  return [...storedAi, ...transient].sort(byScore);
}

/** Score in batches of BATCH_SIZE, 3 calls at a time. */
export async function scoreAll(profile: Profile, todo: Opportunity[]): Promise<Scored[]> {
  const chunks: Opportunity[][] = [];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) chunks.push(todo.slice(i, i + BATCH_SIZE));
  const settled = await mapPool(chunks, CONCURRENCY, (c) => matchBatch(profile, c));
  return settled.flatMap((r, i) => (r.status === "fulfilled" ? r.value : chunks[i].map((o) => ({ ...ruleBasedMatch(profile, o), source: "rules" as const }))));
}

export async function runMatching(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  { maxPerRun = 15, force = false, live = false }: MatchRunOptions = {},
): Promise<MatchRunResult> {
  const demo = !live && demoMode();
  const cacheOnly = !live && matchCacheOnly();

  if (demo || cacheOnly) {
    const matches = cacheOnly && !demo ? (await listUserMatches(supabase, userId, profile)).filter((m) => !m.isFallback) : await loadMatches(supabase, userId, profile);
    return { matches, stats: { opportunities: 0, passedGate: 0, matchedNow: 0, fallbacks: matches.filter((m) => m.isFallback).length, cacheOnly, demo } };
  }

  const opportunities = await listOpportunities(supabase);
  const passed = opportunities.filter((o) => passesGate(profile, o).pass);

  // Fresh = a real AI match from the last 24 h. Fallback rows (old data) are never fresh.
  const stored = await listUserMatches(supabase, userId, profile);
  const fresh = new Set(
    force ? [] : stored.filter((m) => !m.isFallback && Date.now() - new Date(m.createdAt).getTime() < FRESH_MS).map((m) => m.opportunityId),
  );
  const todo = passed.filter((o) => o.id && !fresh.has(o.id)).slice(0, maxPerRun);

  const scored = await scoreAll(profile, todo);
  const now = new Date().toISOString();
  const ai = scored.map((r, i) => ({ r, o: todo[i] })).filter(({ r }) => r.source === "ai");
  if (ai.length > 0) {
    const rows = ai.map(({ r, o }) => ({
      user_id: userId,
      opportunity_id: o.id,
      score: r.score,
      reason: r.reason,
      evidence_map: r.evidenceMap,
      gaps: r.gaps,
      eligibility_uncertain: r.eligibilityUncertain,
      is_fallback: false,
      created_at: now,
    }));
    const { error } = await supabase.from("matches").upsert(rows, { onConflict: "user_id,opportunity_id" });
    if (error) throw new Error(error.message);
  }

  const savedAi = (await listUserMatches(supabase, userId, profile)).filter((m) => !m.isFallback);
  const have = new Set(savedAi.map((m) => m.opportunityId));
  // Anything Gemini could not score right now is shown as a labelled, unsaved fallback; it is retried on the next run.
  const transient = scored
    .map((r, i) => ({ r, o: todo[i] }))
    .filter(({ r, o }) => r.source === "rules" && !have.has(o.id!))
    .map(({ o }) => transientMatch(profile, o));
  const matches = [...savedAi, ...transient].sort(byScore);

  console.log(`[match] opportunities=${opportunities.length} passedGate=${passed.length} scoredNow=${ai.length} fallbacks=${transient.length} cachedFresh=${fresh.size} returned=${matches.length}`);
  return { matches, stats: { opportunities: opportunities.length, passedGate: passed.length, matchedNow: ai.length, fallbacks: transient.length, cacheOnly, demo } };
}
