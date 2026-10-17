// Discovery orchestration: queries -> search -> pick listing URLs (expand index pages) -> fetch -> detect blocks ->
// extract -> validate -> normalise -> liveness -> save each row as it is ready. Owner: Dev B.
// No DB access of its own (the caller passes onRow), so every step can be tested with fake deps.
import { mapPool } from "@/lib/pool";
import type { Opportunity, OpportunityType } from "@/types";
import { canonicalUrl, dedupeOpportunities } from "./dedupe";
import { detectBlocked, extractListing } from "./extract";
import { fetchDetailLinks } from "./indexLinks";
import { checkLive } from "./liveness";
import { normalizeOpportunity } from "./normalize";
import { buildQueries, type DiscoveryProfile } from "./queries";
import { isValidSourceUrl, siteName } from "./sites";
import * as tinyfish from "./tinyfish";
import { classifyUrl } from "./urlClassifier";

export const MAX_QUERIES_RUN = 6;
export const MAX_PAGES = 10; // pages fetched per run, including expanded index links and stale re-fetches
export const MAX_PER_SITE = 3; // so one platform cannot take the whole run
export const CONCURRENCY = 5;
export const RUN_BUDGET_MS = 60_000; // stop starting new work after this long and return what is saved
export const PAGE_TIMEOUT_MS = 45_000; // per page: extraction + liveness
const RECENT_DAYS = 150; // only search pages published/updated in roughly the last 5 months
const INDEX_EXPANSIONS = 3; // index pages expanded per run, up to 3 detail links each

export interface SkippedUrl {
  url: string;
  site: string;
  reason: string;
}

export interface SiteStat {
  tried: number;
  stored: number;
  skipped: Record<string, number>;
}

export interface Target {
  url: string;
  type?: OpportunityType;
}

export interface DiscoveryDeps {
  search: (query: string, opts?: { afterDate?: string }) => Promise<tinyfish.SearchResult[]>;
  fetchPages: (urls: string[]) => Promise<tinyfish.FetchBatch>;
  extractListing: typeof extractListing;
  checkLive: typeof checkLive;
  fetchDetailLinks: typeof fetchDetailLinks;
}

export interface RunHooks {
  onProgress?: (p: { stage: "searching" | "extracting"; total: number; done: number }) => void | Promise<void>;
  /** Called as soon as a row is ready, so it can be saved before the run ends. */
  onRow?: (o: Opportunity) => void | Promise<void>;
  budgetMs?: number;
}

export interface DiscoveryResult {
  opportunities: Opportunity[];
  skipped: SkippedUrl[];
  queries: number;
  urls: number;
  bySite: Record<string, SiteStat>;
  /** Set when the live search could not run at all (TinyFish 401, network down, ...). */
  warning: string | null;
  budgetExceeded: boolean;
  ms: number;
}

const defaultDeps: DiscoveryDeps = { search: tinyfish.search, fetchPages: tinyfish.fetchPages, extractListing, checkLive, fetchDetailLinks };

/**
 * Choose which URLs to fetch. Stale records come first, then search results interleaved across queries.
 * Only single-listing URLs qualify; index/search/article pages are rejected (and returned so they can be expanded).
 * At most `perSite` pages per platform.
 */
export function planPages(
  perQuery: { type: OpportunityType; urls: string[] }[],
  stale: Target[] = [],
  { cap = MAX_PAGES, perSite = MAX_PER_SITE, known = new Set<string>() }: { cap?: number; perSite?: number; known?: Set<string> } = {},
): { targets: Target[]; rejected: SkippedUrl[]; indexPages: Target[] } {
  const targets: Target[] = [];
  const rejected: SkippedUrl[] = [];
  const indexPages: Target[] = [];
  const seen = new Set<string>();
  const perSiteCount = new Map<string, number>();

  const consider = (url: string, type: OpportunityType | undefined, isStale: boolean) => {
    if (targets.length >= cap) return;
    const key = canonicalUrl(url);
    if (seen.has(key)) return;
    seen.add(key);
    if (!isStale && known.has(key)) return; // fetched recently already: spend the slot on something new
    const site = siteName(url);
    if (!isValidSourceUrl(url)) return void rejected.push({ url, site, reason: "invalid url" });
    const cls = classifyUrl(url);
    if (cls === "index") {
      indexPages.push({ url, type });
      return void rejected.push({ url, site, reason: "index page (many listings)" });
    }
    if (cls === "skip") return void rejected.push({ url, site, reason: "not a listing page" });
    if (!isStale && (perSiteCount.get(site) ?? 0) >= perSite) return;
    perSiteCount.set(site, (perSiteCount.get(site) ?? 0) + 1);
    targets.push({ url, type });
  };

  for (const s of stale) consider(s.url, s.type, true);
  for (let i = 0; targets.length < cap; i++) {
    let any = false;
    for (const { type, urls } of perQuery) {
      if (urls[i]) {
        any = true;
        consider(urls[i], type, false);
      }
    }
    if (!any) break;
  }
  return { targets, rejected, indexPages };
}

const LOGIN_REDIRECT = /(authwall|\/login|\/signin|\/sign-in|\/uas\/login|\/checkpoint|\/accounts\/login)/i;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))]);

export async function runDiscovery(
  profile: DiscoveryProfile,
  { seed = 0, stale = [], known = new Set<string>(), deps = defaultDeps, hooks = {} }: { seed?: number; stale?: Target[]; known?: Set<string>; deps?: DiscoveryDeps; hooks?: RunHooks } = {},
): Promise<DiscoveryResult> {
  const startedAt = Date.now();
  const budgetMs = hooks.budgetMs ?? RUN_BUDGET_MS;
  const overBudget = () => Date.now() - startedAt > budgetMs;
  const queries = buildQueries(profile, { seed }).slice(0, MAX_QUERIES_RUN);
  const skipped: SkippedUrl[] = [];
  const bySite: Record<string, SiteStat> = {};
  const stat = (site: string) => (bySite[site] ??= { tried: 0, stored: 0, skipped: {} });
  const skip = (url: string, reason: string) => {
    const site = siteName(url);
    skipped.push({ url, site, reason });
    const bucket = reason.split(":")[0];
    const s = stat(site);
    s.skipped[bucket] = (s.skipped[bucket] ?? 0) + 1;
  };
  let budgetExceeded = false;

  // 1. Search (site-targeted queries, recent pages only)
  await hooks.onProgress?.({ stage: "searching", total: 0, done: 0 });
  const afterDate = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const searched = await Promise.allSettled(queries.map((q) => deps.search(q.query, { afterDate })));
  const searchErrors = searched.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  const perQuery = searched.map((r, i) => {
    if (r.status === "rejected") skipped.push({ url: `search: ${queries[i].query}`, site: "search", reason: String(r.reason?.message ?? r.reason) });
    return { type: queries[i].type, urls: r.status === "fulfilled" ? r.value.map((x) => x.url) : [] };
  });
  let warning: string | null = null;
  if (queries.length > 0 && searchErrors.length === queries.length) {
    warning = `Live search unavailable (${String(searchErrors[0].reason?.message ?? searchErrors[0].reason).slice(0, 120)}). Showing saved results.`;
  }

  // 2. Pick single-listing URLs
  const { targets, rejected, indexPages } = planPages(perQuery, stale, { known });
  for (const r of rejected.slice(0, 30)) skip(r.url, r.reason);

  // 2b. Types whose queries returned only index pages: read the index page and take up to 3 detail links from it.
  const covered = new Set(targets.map((t) => t.type));
  const wanted = indexPages.filter((ix) => !covered.has(ix.type) || targets.length < MAX_PAGES / 2).slice(0, INDEX_EXPANSIONS);
  const expanded = await Promise.all(wanted.map(async (ix) => ({ ix, links: overBudget() ? [] : await deps.fetchDetailLinks(ix.url, 3) })));
  const seen = new Set(targets.map((t) => canonicalUrl(t.url)));
  for (const { ix, links } of expanded) {
    for (const link of links) {
      if (targets.length >= MAX_PAGES) break;
      const key = canonicalUrl(link);
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ url: link, type: ix.type });
    }
  }

  // 3. Fetch them (one batch: MAX_PAGES <= 10)
  let batch: tinyfish.FetchBatch = { pages: [], errors: [] };
  if (targets.length > 0) {
    try {
      batch = await deps.fetchPages(targets.map((t) => t.url));
    } catch (e) {
      for (const t of targets) skip(t.url, `unreachable: ${e instanceof Error ? e.message : "fetch failed"}`);
      warning ??= `Live fetch unavailable (${e instanceof Error ? e.message.slice(0, 120) : "error"}). Showing saved results.`;
    }
  }
  for (const err of batch.errors) {
    stat(siteName(err.url)).tried++;
    skip(err.url, `unreachable: ${err.error}`);
  }

  // 4. Per page: block detection, extraction + validation against the page text, normalisation, liveness, save.
  const total = batch.pages.length;
  let done = 0;
  await hooks.onProgress?.({ stage: "extracting", total, done });
  const typeByUrl = new Map(targets.map((t) => [t.url, t.type]));
  const found: Opportunity[] = [];

  const processPage = async (page: tinyfish.FetchedPage) => {
    stat(siteName(page.finalUrl)).tried++;
    if (overBudget()) {
      budgetExceeded = true;
      return skip(page.url, "run time budget exceeded");
    }
    if (!isValidSourceUrl(page.finalUrl)) return skip(page.url, "invalid url");
    if (LOGIN_REDIRECT.test(new URL(page.finalUrl).pathname)) return skip(page.url, "blocked: login redirect");
    const blocked = detectBlocked(page);
    if (blocked) return skip(page.url, `blocked: ${blocked}`);

    const raw = await deps.extractListing(page);
    if (!raw) return skip(page.url, "extraction failed");
    if (raw.isSingleListing === false) return skip(page.url, "not a single listing");
    const opportunity = normalizeOpportunity(raw, { sourceUrl: page.finalUrl, typeHint: typeByUrl.get(page.url) });
    if (!opportunity) return skip(page.url, "no title/organisation on the page");

    const live = await deps.checkLive(opportunity.sourceUrl);
    opportunity.httpStatus = live.status;
    if (live.dead) opportunity.flag = "dead_link";
    found.push(opportunity);
    stat(opportunity.sourceSite ?? siteName(opportunity.sourceUrl)).stored++;
    await hooks.onRow?.(opportunity);
  };

  const results = await mapPool(batch.pages, CONCURRENCY, async (page) => {
    try {
      await withTimeout(processPage(page), PAGE_TIMEOUT_MS);
    } finally {
      done++;
      await hooks.onProgress?.({ stage: "extracting", total, done });
    }
  });
  results.forEach((r, i) => {
    if (r.status === "rejected") skip(batch.pages[i].url, `extraction failed: ${String(r.reason?.message ?? r.reason).slice(0, 100)}`);
  });

  return {
    opportunities: dedupeOpportunities(found),
    skipped,
    queries: queries.length,
    urls: targets.length,
    bySite,
    warning,
    budgetExceeded,
    ms: Date.now() - startedAt,
  };
}
