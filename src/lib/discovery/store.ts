// Opportunities table access. Owner: Dev B.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opportunity, OpportunityFlag } from "@/types";
import { isExpired } from "./normalize";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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
    fetchedAt: new Date(r.fetched_at).toISOString(),
    evidenceSnippets: r.evidence_snippets ?? [],
    // Deadlines pass over time, so "expired" is recomputed on read rather than trusted from storage.
    flag: isExpired(deadline) ? "expired" : ((r.flag as OpportunityFlag | null) ?? null),
  };
};

// Needs the service-role client (opportunities has no write policies).
export async function upsertOpportunities(admin: SupabaseClient, list: Opportunity[]): Promise<Opportunity[]> {
  if (list.length === 0) return [];
  const { data, error } = await admin
    .from("opportunities")
    .upsert(list.map(toRow), { onConflict: "org,title,deadline" })
    .select("*");
  if (error) throw new Error(`Could not store opportunities: ${error.message}`);
  return (data ?? []).map(fromRow);
}

// Reads only the cache; never touches the web.
export async function listOpportunities(supabase: SupabaseClient, type?: string): Promise<Opportunity[]> {
  let query = supabase.from("opportunities").select("*").limit(200);
  if (type) query = query.eq("type", type);
  const { data, error } = await query.order("deadline", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}
