// Fallback/demo opportunities for DEMO_MODE. Owner: Dev B.
// Data: scripts/seed-fallback.json (synthetic placeholders; deadlines are relative to today).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opportunity, OpportunityFlag, OpportunityType } from "@/types";
import seedFile from "../../../scripts/seed-fallback.json";
import { upsertOpportunities } from "./store";

// All seeded rows share this URL prefix so they can be found (and replaced) later.
export const SEED_URL_PREFIX = "https://example.com/demo/";

interface SeedEntry {
  slug: string;
  type: string;
  title: string;
  org: string;
  eligibilityText: string;
  daysFromNow: number | null;
  location: string;
  remote: boolean;
  reward: string | null;
  evidenceSnippets: string[];
  flag?: string;
}

export function seedOpportunities(now = new Date()): Opportunity[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return (seedFile.opportunities as SeedEntry[]).map((s) => ({
    type: s.type as OpportunityType,
    title: s.title,
    org: s.org,
    eligibilityText: s.eligibilityText,
    deadline: s.daysFromNow === null ? null : new Date(today + s.daysFromNow * 86_400_000).toISOString(),
    location: s.location,
    remote: s.remote,
    reward: s.reward,
    sourceUrl: `${SEED_URL_PREFIX}${s.slug}`,
    fetchedAt: now.toISOString(),
    evidenceSnippets: s.evidenceSnippets,
    flag: (s.flag as OpportunityFlag | undefined) ?? null,
  }));
}

// Insert the seed set if it isn't there yet. `reseed` deletes old seeded rows first so deadlines are fresh.
// Deadlines move every day, so re-upserting without deleting would create duplicates (the dedupe key includes the deadline).
export async function ensureSeeded(admin: SupabaseClient, { reseed = false } = {}): Promise<number> {
  const seeds = seedOpportunities();
  const like = `${SEED_URL_PREFIX}%`;

  if (reseed) {
    const { error } = await admin.from("opportunities").delete().like("source_url", like);
    if (error) throw new Error(`Could not clear old seed data: ${error.message}`);
  } else {
    const { count, error } = await admin.from("opportunities").select("id", { count: "exact", head: true }).like("source_url", like);
    if (error) throw new Error(error.message);
    if ((count ?? 0) >= seeds.length) return 0;
  }
  return (await upsertOpportunities(admin, seeds)).length;
}
