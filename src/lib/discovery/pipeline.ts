// Discovery entry point shared by POST /api/discover and scripts/prefetch-demo.ts. Owner: Dev B.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opportunity, Profile } from "@/types";
import { runDiscovery, type SiteStat, type SkippedUrl } from "./run";
import { listOpportunities, listStale, upsertOpportunities } from "./store";

export const demoMode = () => process.env.DEMO_MODE === "true";

export interface DiscoverResult {
  opportunities: Opportunity[];
  skipped: SkippedUrl[];
  bySite: Record<string, SiteStat>;
  demo: boolean;
}

// DEMO_MODE (unless `live` is forced): never touch the web, serve only what our own pipeline fetched earlier
// (run `npm run prefetch` to create that snapshot). Nothing is invented or hand-written.
// Otherwise: real discovery. `seed` rotates which platforms are searched; stale records (>7 days) are re-fetched first.
export async function discover(admin: SupabaseClient, profile: Profile, { live = false, seed = Math.floor(Date.now() / 3_600_000) } = {}): Promise<DiscoverResult> {
  if (demoMode() && !live) {
    return { opportunities: await listOpportunities(admin), skipped: [], bySite: {}, demo: true };
  }

  const stale = await listStale(admin).catch(() => []);
  const result = await runDiscovery(profile, { seed, stale });
  const stored = await upsertOpportunities(admin, result.opportunities);
  console.log(
    `[discover] queries=${result.queries} urls=${result.urls} extracted=${result.opportunities.length} skipped=${result.skipped.length} stored=${stored.length}`,
  );
  return { opportunities: stored, skipped: result.skipped, bySite: result.bySite, demo: false };
}
