// De-duplication. Owner: Dev B.
import type { Opportunity } from "@/types";

// lowercase(org) + lowercase(title) + deadline date
export const dedupeKey = (o: Pick<Opportunity, "org" | "title" | "deadline">) =>
  [o.org.toLowerCase(), o.title.toLowerCase(), o.deadline?.slice(0, 10) ?? ""].join("|");

// Collapse duplicates within one run (Postgres rejects an upsert that hits the same row twice).
// The first record wins; evidence snippets from later duplicates are merged in.
export function dedupeOpportunities(list: Opportunity[]): Opportunity[] {
  const byKey = new Map<string, Opportunity>();
  for (const o of list) {
    const existing = byKey.get(dedupeKey(o));
    if (!existing) {
      byKey.set(dedupeKey(o), o);
    } else {
      existing.evidenceSnippets = [...new Set([...existing.evidenceSnippets, ...o.evidenceSnippets])].slice(0, 5);
      existing.eligibilityText ||= o.eligibilityText;
    }
  }
  return [...byKey.values()];
}
