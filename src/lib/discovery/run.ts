// Discovery orchestration: queries -> search -> pick URLs -> extract -> normalize -> dedupe. Owner: Dev B.
// Pure of DB access so it can be tested with fake search/extract functions.
import type { Opportunity, OpportunityType } from "@/types";
import { mapPool } from "@/lib/pool";
import { dedupeOpportunities } from "./dedupe";
import { normalizeOpportunity } from "./normalize";
import { buildQueries, type DiscoveryProfile } from "./queries";
import * as tinyfish from "./tinyfish";

export const MAX_PAGES = 12;
export const CONCURRENCY = 4;
// Stop starting new pages after this long so the whole run fits the route's 300s limit.
export const START_BUDGET_MS = 170_000;

// Listing indexes and social sites rarely hold a single extractable opportunity.
const SKIP_HOSTS = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|instagram\.com|twitter\.com|x\.com|reddit\.com|quora\.com|pinterest\.com)$/;

export interface Skipped {
  url: string;
  reason: string;
}

export interface DiscoveryDeps {
  search: (query: string) => Promise<tinyfish.SearchResult[]>;
  extract: (url: string) => Promise<tinyfish.RawExtraction>;
}

export interface DiscoveryResult {
  opportunities: Opportunity[];
  skipped: Skipped[];
  queries: number;
  urls: number;
}

// Interleave results across queries so each type is represented, de-duplicate URLs, cap the total.
export function pickUrls(perQuery: { type: OpportunityType; urls: string[] }[], cap = MAX_PAGES) {
  const picked = new Map<string, OpportunityType>();
  for (let i = 0; picked.size < cap; i++) {
    let any = false;
    for (const { type, urls } of perQuery) {
      const url = urls[i];
      if (!url) continue;
      any = true;
      if (picked.size < cap && !picked.has(url) && isCandidate(url)) picked.set(url, type);
    }
    if (!any) break;
  }
  return [...picked].map(([url, type]) => ({ url, type }));
}

function isCandidate(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === "http:" || protocol === "https:") && !SKIP_HOSTS.test(hostname);
  } catch {
    return false;
  }
}

export async function runDiscovery(
  profile: DiscoveryProfile,
  deps: DiscoveryDeps = tinyfish,
): Promise<DiscoveryResult> {
  const queries = buildQueries(profile);
  const skipped: Skipped[] = [];

  const searched = await Promise.allSettled(queries.map((q) => deps.search(q.query)));
  const perQuery = searched.map((r, i) => {
    if (r.status === "rejected") skipped.push({ url: `search: ${queries[i].query}`, reason: String(r.reason?.message ?? r.reason) });
    return { type: queries[i].type, urls: r.status === "fulfilled" ? r.value.map((x) => x.url) : [] };
  });

  const targets = pickUrls(perQuery);
  const startedAt = Date.now();
  const extracted = await mapPool(targets, CONCURRENCY, async ({ url, type }) => {
    if (Date.now() - startedAt > START_BUDGET_MS) throw new Error("Skipped: run time budget exceeded");
    const raw = await deps.extract(url);
    const opportunity = normalizeOpportunity(raw, url, type);
    if (!opportunity) throw new Error("Page is not a single identifiable opportunity");
    return opportunity;
  });

  const found: Opportunity[] = [];
  extracted.forEach((r, i) => {
    if (r.status === "fulfilled") found.push(r.value);
    else skipped.push({ url: targets[i].url, reason: String(r.reason?.message ?? r.reason) });
  });

  return { opportunities: dedupeOpportunities(found), skipped, queries: queries.length, urls: targets.length };
}
