// De-duplication. Owner: Dev B.
import type { Opportunity } from "@/types";

// Page identity (the `source_key` column): lower-case host without www, path without trailing slash, no fragment or tracking params.
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref|source|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url;
  }
}

// One page = one opportunity. Falls back to org + title (+ deadline date) so a listing reposted under another URL collapses too.
export const dedupeKeys = (o: Pick<Opportunity, "org" | "title" | "deadline" | "sourceUrl">) => [
  `url|${canonicalUrl(o.sourceUrl)}`,
  `meta|${o.org.toLowerCase()}|${o.title.toLowerCase()}|${o.deadline?.slice(0, 10) ?? ""}`,
];

// Collapse duplicates within one run. The first record wins; evidence snippets from later duplicates are merged in.
export function dedupeOpportunities(list: Opportunity[]): Opportunity[] {
  const byKey = new Map<string, Opportunity>();
  const out: Opportunity[] = [];
  for (const o of list) {
    const keys = dedupeKeys(o);
    const existing = keys.map((k) => byKey.get(k)).find(Boolean);
    if (!existing) {
      out.push(o);
      keys.forEach((k) => byKey.set(k, o));
    } else {
      existing.evidenceSnippets = [...new Set([...existing.evidenceSnippets, ...o.evidenceSnippets])].slice(0, 5);
      existing.eligibilityText ||= o.eligibilityText;
    }
  }
  return out;
}
