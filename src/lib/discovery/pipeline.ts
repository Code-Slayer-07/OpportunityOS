// Discovery entry point shared by POST /api/discover and scripts/prefetch-demo.ts. Owner: Dev B.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opportunity, Profile } from "@/types";
import { runDiscovery, type Skipped } from "./run";
import { ensureSeeded } from "./seed";
import { listOpportunities, upsertOpportunities } from "./store";

export const demoMode = () => process.env.DEMO_MODE === "true";

export interface DiscoverResult {
  opportunities: Opportunity[];
  skipped: Skipped[];
  demo: boolean;
}

// DEMO_MODE (unless `live` is forced): never touch the web. Make sure the seed set exists and serve the cache.
// Otherwise: live TinyFish discovery, stored with the service-role client `admin`.
export async function discover(admin: SupabaseClient, profile: Profile, { live = false } = {}): Promise<DiscoverResult> {
  if (demoMode() && !live) {
    await ensureSeeded(admin);
    return { opportunities: await listOpportunities(admin), skipped: [], demo: true };
  }

  const result = await runDiscovery(profile);
  const stored = await upsertOpportunities(admin, result.opportunities);
  console.log(
    `[discover] queries=${result.queries} urls=${result.urls} extracted=${result.opportunities.length} skipped=${result.skipped.length} stored=${stored.length}`,
  );
  return { opportunities: stored, skipped: result.skipped, demo: false };
}
