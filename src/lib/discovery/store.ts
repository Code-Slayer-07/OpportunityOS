// Opportunities table access. Owner: Dev B.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opportunity, OpportunityFlag, OpportunityType } from "@/types";
import { canonicalUrl } from "./dedupe";
import { isExpired } from "./normalize";
import { isValidSourceUrl, siteName } from "./sites";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const STALE_DAYS = 7;

const toRow = (o: Opportunity) => ({
  type: o.type,
  title: o.title,
  org: o.org,
  eligibility_text: o.eligibilityText || null,
  deadline: o.deadline,
  location: o.location || null,
  remote: o.remote,
  reward: o.reward,
  source_url: o.sourceUrl,
  source_key: canonicalUrl(o.sourceUrl),
  source_site: o.sourceSite ?? siteName(o.sourceUrl),
  apply_url: o.applyUrl ?? null,
  origin: "live_fetch",
  http_status: o.httpStatus ?? null,
  fetched_at: o.fetchedAt, // refreshed on every re-fetch
  evidence_snippets: o.evidenceSnippets,
  flag: o.flag ?? null,
});

export const fromRow = (r: Row): Opportunity => {
  const deadline: string | null = r.deadline ? new Date(r.deadline).toISOString() : null;
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    org: r.org,
    eligibilityText: r.eligibility_text ?? "",
    deadline,
    location: r.location ?? "",
    remote: r.remote,
    reward: r.reward,
    sourceUrl: r.source_url,
    sourceSite: r.source_site ?? siteName(r.source_url),
    applyUrl: r.apply_url ?? null,
    origin: r.origin ?? null,
    httpStatus: r.http_status ?? null,
    fetchedAt: new Date(r.fetched_at).toISOString(),
    evidenceSnippets: r.evidence_snippets ?? [],
    // A dead link stays dead; otherwise "expired" is recomputed on read because deadlines pass over time.
    flag: r.flag === "dead_link" ? "dead_link" : isExpired(deadline) ? "expired" : ((r.flag as OpportunityFlag | null) ?? null),
  };
};

/** Rows we never show: dead links and anything without a real source URL. */
export const isShowable = (o: Opportunity) => o.flag !== "dead_link" && isValidSourceUrl(o.sourceUrl);

// Needs the service-role client (opportunities has no write policies). One row per source URL.
export async function upsertOpportunities(admin: SupabaseClient, list: Opportunity[]): Promise<Opportunity[]> {
  const real = list.filter((o) => isValidSourceUrl(o.sourceUrl));
  if (real.length === 0) return [];
  const { data, error } = await admin.from("opportunities").upsert(real.map(toRow), { onConflict: "source_key" }).select("*");
  if (error) throw new Error(`Could not store opportunities: ${error.message}`);
  return (data ?? []).map(fromRow);
}

// Reads only the cache; never touches the web. Dead links are hidden.
export async function listOpportunities(supabase: SupabaseClient, type?: string): Promise<Opportunity[]> {
  let query = supabase.from("opportunities").select("*").limit(300);
  if (type) query = query.eq("type", type);
  const { data, error } = await query.order("deadline", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow).filter(isShowable);
}

/** Cached records older than STALE_DAYS: the next discovery run fetches these again first. */
export async function listStale(admin: SupabaseClient, limit = 3): Promise<{ url: string; type: OpportunityType }[]> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("opportunities")
    .select("source_url, type")
    .eq("origin", "live_fetch")
    .lt("fetched_at", cutoff)
    .order("fetched_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ url: r.source_url, type: r.type }));
}

/** source_keys of pages fetched within STALE_DAYS: discovery skips these and spends its slots on new pages. */
export async function listKnownKeys(admin: SupabaseClient): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin.from("opportunities").select("source_key").gte("fetched_at", cutoff).limit(2000);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.source_key).filter(Boolean));
}
