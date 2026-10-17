// Validated extraction -> unified Opportunity. Owner: Dev B.
import type { Opportunity, OpportunityFlag, OpportunityType } from "@/types";
import type { RawExtraction } from "./extract";
import { isValidSourceUrl, siteName } from "./sites";

const TYPES: OpportunityType[] = ["internship", "job", "hackathon", "scholarship"];
const MAX_SNIPPETS = 5;

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const monthOf = (s: string) => MONTHS[s.slice(0, 3).toLowerCase()];
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

// Returns an ISO timestamp at UTC midnight, or null if no full date can be read. We only ever read the date out of
// the text the page showed; a date without a year is not guessed.
export function parseDeadline(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;

  let y: number | undefined, m: number | undefined, d: number | undefined;
  let hit: RegExpMatchArray | null;
  if ((hit = text.match(/(\d{4})-(\d{2})-(\d{2})/))) [y, m, d] = [+hit[1], +hit[2] - 1, +hit[3]];
  else if ((hit = text.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4}|\d{2})\b/))) [d, m, y] = [+hit[1], monthOf(hit[2]), fullYear(hit[3])];
  else if ((hit = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/))) [m, d, y] = [monthOf(hit[1]), +hit[2], +hit[3]];
  else if ((hit = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/))) [d, m, y] = [+hit[1], +hit[2] - 1, +hit[3]]; // day first (India)

  if (y === undefined || m === undefined || d === undefined || Number.isNaN(m) || m < 0 || m > 11 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m, d));
  if (date.getUTCMonth() !== m || y < 2000 || y > 2100) return null;
  return date.toISOString();
}

export function isComplete(o: Pick<Opportunity, "title" | "org" | "sourceUrl" | "eligibilityText" | "evidenceSnippets">) {
  return !!(o.title && o.org && o.sourceUrl && (o.eligibilityText || o.evidenceSnippets.length > 0));
}

export function isExpired(deadline: string | null, now = new Date()) {
  if (!deadline) return false;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(deadline).getTime() < startOfToday;
}

export interface NormalizeContext {
  /** URL of the page after redirects. */
  sourceUrl: string;
  typeHint?: OpportunityType;
  now?: Date;
}

// Returns null when the record is unusable (no title/org, no type, or a fake/invalid URL).
// A missing deadline/eligibility/reward stays null/empty: nothing is filled in.
export function normalizeOpportunity(raw: RawExtraction, { sourceUrl, typeHint, now = new Date() }: NormalizeContext): Opportunity | null {
  if (!isValidSourceUrl(sourceUrl)) return null;
  const title = clean(raw.title);
  const org = clean(raw.org);
  const rawType = clean(raw.type).toLowerCase() as OpportunityType;
  const type = TYPES.includes(rawType) ? rawType : typeHint;
  if (!title || !org || !type) return null;

  const deadline = parseDeadline(raw.deadlineText);
  const snippets = [...new Set((raw.evidenceSnippets ?? []).map(clean).filter(Boolean))].slice(0, MAX_SNIPPETS);
  const location = clean(raw.location);

  const opportunity: Opportunity = {
    type,
    title,
    org,
    eligibilityText: clean(raw.eligibilityText),
    deadline,
    location,
    remote: raw.remote === true,
    reward: clean(raw.reward) || null,
    sourceUrl,
    fetchedAt: now.toISOString(),
    evidenceSnippets: snippets,
    sourceSite: siteName(sourceUrl),
    applyUrl: raw.applyUrl && isValidSourceUrl(raw.applyUrl) ? raw.applyUrl : null,
    origin: "live_fetch",
  };

  const deadlineUnreadable = clean(raw.deadlineText) !== "" && deadline === null;
  let flag: OpportunityFlag | null = null;
  if (isExpired(deadline, now)) flag = "expired";
  else if (!isComplete(opportunity) || deadlineUnreadable) flag = "incomplete";
  return { ...opportunity, flag };
}
