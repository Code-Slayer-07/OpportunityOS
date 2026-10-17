// Raw extraction -> unified Opportunity. Owner: Dev B.
import type { Opportunity, OpportunityFlag, OpportunityType } from "@/types";
import type { RawExtraction } from "./tinyfish";

const TYPES: OpportunityType[] = ["internship", "job", "hackathon", "scholarship"];
const MAX_SNIPPETS = 5;

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

// Returns an ISO timestamp at UTC midnight, or null if no full date can be read.
// Requires an explicit year: "Nov 15" would otherwise parse to a bogus year.
export function parseDeadline(value: unknown): string | null {
  const text = clean(value);
  if (!text || !/\b(19|20)\d{2}\b/.test(text)) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let utc: number;
  if (iso) {
    utc = Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  } else {
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) return null;
    utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const date = new Date(utc);
  const year = date.getUTCFullYear();
  return Number.isNaN(utc) || year < 2000 || year > 2100 ? null : date.toISOString();
}

export function isComplete(o: Pick<Opportunity, "title" | "org" | "sourceUrl" | "eligibilityText" | "evidenceSnippets">) {
  return !!(o.title && o.org && o.sourceUrl && (o.eligibilityText || o.evidenceSnippets.length > 0));
}

export function isExpired(deadline: string | null, now = new Date()) {
  if (!deadline) return false;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(deadline).getTime() < startOfToday;
}

// Returns null only when the record is unusable (no title/org or unknown type); everything else is kept with a flag.
export function normalizeOpportunity(
  raw: RawExtraction,
  sourceUrl: string,
  typeHint?: OpportunityType,
  now = new Date(),
): Opportunity | null {
  const title = clean(raw.title);
  const org = clean(raw.org);
  const rawType = clean(raw.type).toLowerCase() as OpportunityType;
  const type = TYPES.includes(rawType) ? rawType : typeHint;
  if (!title || !org || !type) return null;

  const deadline = parseDeadline(raw.deadline);
  const snippets = [...new Set((raw.evidenceSnippets ?? []).map(clean).filter(Boolean))].slice(0, MAX_SNIPPETS);
  const location = clean(raw.location);

  const opportunity: Opportunity = {
    type,
    title,
    org,
    eligibilityText: clean(raw.eligibilityText),
    deadline,
    location,
    remote: raw.remote === true || /\bremote\b/i.test(location),
    reward: clean(raw.reward) || null,
    sourceUrl,
    fetchedAt: now.toISOString(),
    evidenceSnippets: snippets,
  };

  const deadlineUnreadable = clean(raw.deadline) !== "" && deadline === null;
  let flag: OpportunityFlag | null = null;
  if (isExpired(deadline, now)) flag = "expired";
  else if (!isComplete(opportunity) || deadlineUnreadable) flag = "incomplete";
  return { ...opportunity, flag };
}
