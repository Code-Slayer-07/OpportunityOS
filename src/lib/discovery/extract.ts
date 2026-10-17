// Turn a fetched page into structured fields, using ONLY what is on the page. Owner: Dev B.
//
// Gemini reads the page text and returns candidate fields. Every value is then checked against the page text
// and dropped if it does not appear there, so a missing field is null rather than something the model invented.
import { DEFAULT_EXTRACT_MODEL, DEFAULT_MODEL, generateJson } from "@/lib/matching/gemini";
import type { FetchedPage } from "./tinyfish";

export interface RawExtraction {
  isSingleListing?: boolean;
  title?: string | null;
  org?: string | null;
  type?: string | null;
  eligibilityText?: string | null;
  deadlineText?: string | null;
  location?: string | null;
  remote?: boolean | null;
  reward?: string | null;
  applyUrl?: string | null;
  evidenceSnippets?: string[] | null;
}

// The second attempt uses a different model, because the first one is the usual casualty of a 503/timeout.
export type Generate = (system: string, user: string, schema: object, model?: string) => Promise<string>;
const FALLBACK_MODEL = DEFAULT_MODEL;

const MAX_TEXT = 14_000;
const MAX_SNIPPETS = 5;

// ----------------------------------------------------------------- blocked / non-listing detection

const CAPTCHA = /(captcha|are you (a )?(human|robot)|verify (that )?you are (a )?human|unusual traffic|access denied|request blocked|security check|attention required)/i;
const LOGIN_WALL = /(sign in to (view|see|continue|apply)|log ?in to (view|see|continue|apply)|join (now )?to (view|see|apply)|please (sign|log) ?in|create (an )?account to)/i;
const NOT_FOUND = /(page not found|404 not found|error 404|no longer available|this (job|listing|opportunity|page) (is|has been) (no longer|removed|closed|expired)|does not exist)/i;
const COOKIE_WALL = /(accept (all )?cookies|we use cookies)/i;

/** Returns why a page cannot be used (login wall, captcha, empty, ...), or null. We never try to get around these. */
export function detectBlocked(page: Pick<FetchedPage, "title" | "text">): string | null {
  const text = page.text.trim();
  const len = text.length;
  const head = `${page.title}\n${text.slice(0, 1500)}`;
  if (len < 250) return "empty content";
  if (CAPTCHA.test(head) && len < 4000) return "captcha or bot check";
  if (/^\s*(sign in|log ?in|sign up|join now)\b/i.test(page.title) && len < 4000) return "login wall";
  if (LOGIN_WALL.test(head) && len < 2500) return "login wall";
  if (NOT_FOUND.test(head) && len < 3000) return "page not found";
  if (COOKIE_WALL.test(head) && len < 900) return "cookie wall";
  return null;
}

// ----------------------------------------------------------------- validation against the page text

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[*_#>\[\]()|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True if `value` occurs in the page text (case, quotes and whitespace insensitive). */
export function appearsIn(value: string | null | undefined, haystackNorm: string): boolean {
  if (!value) return false;
  const v = norm(value);
  return v.length > 0 && haystackNorm.includes(v);
}

const REMOTE_WORDS = /\b(remote|work from home|wfh|online|virtual)\b/i;

/** Drop every field whose value is not in the page text. Title and org are required to keep the record. */
export function validateAgainstText(raw: RawExtraction, page: Pick<FetchedPage, "title" | "text">): RawExtraction {
  const hay = norm(`${page.title}\n${page.text}`);
  const keep = (v: string | null | undefined) => (appearsIn(v, hay) ? v!.trim() : null);

  const snippets: string[] = [];
  for (const s of raw.evidenceSnippets ?? []) {
    const k = keep(s);
    if (k && !snippets.includes(k)) snippets.push(k);
    if (snippets.length >= MAX_SNIPPETS) break;
  }

  const applyUrl = raw.applyUrl && /^https?:\/\//i.test(raw.applyUrl) && page.text.includes(raw.applyUrl) ? raw.applyUrl : null;

  return {
    isSingleListing: raw.isSingleListing,
    title: keep(raw.title),
    org: keep(raw.org),
    type: raw.type,
    eligibilityText: keep(raw.eligibilityText),
    deadlineText: keep(raw.deadlineText),
    location: keep(raw.location),
    // "remote" is only believed when the page itself says so.
    remote: raw.remote === true && REMOTE_WORDS.test(page.text) ? true : false,
    reward: keep(raw.reward),
    applyUrl,
    evidenceSnippets: snippets,
  };
}

// ----------------------------------------------------------------- Gemini extraction

const SYSTEM = `You extract structured data from the text of ONE web page about an opportunity (internship, job, hackathon or scholarship).
Rules:
- Use ONLY text that appears on the page. Copy values EXACTLY as written (same words, same spelling). Never paraphrase, translate, summarise or guess.
- If a field is not on the page, return null for it. Never fill a missing field.
- isSingleListing is true only if the page describes exactly one specific opportunity. Search results, category pages, homepages, login pages, error pages and articles about many opportunities are false.
- evidenceSnippets: up to 5 sentences or phrases copied exactly from the page that state who may apply or what is required.
- deadlineText: the application or registration deadline exactly as the page writes it.
- type: internship, job, hackathon or scholarship.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isSingleListing: { type: "BOOLEAN" },
    title: { type: "STRING", nullable: true },
    org: { type: "STRING", nullable: true },
    type: { type: "STRING", enum: ["internship", "job", "hackathon", "scholarship"], nullable: true },
    eligibilityText: { type: "STRING", nullable: true },
    deadlineText: { type: "STRING", nullable: true },
    location: { type: "STRING", nullable: true },
    remote: { type: "BOOLEAN", nullable: true },
    reward: { type: "STRING", nullable: true },
    applyUrl: { type: "STRING", nullable: true },
    evidenceSnippets: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["isSingleListing", "evidenceSnippets"],
};

const defaultGenerate: Generate = (system, user, schema, model) => generateJson(system, user, schema, model);

function parse(text: string): RawExtraction {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const j = JSON.parse(body);
  if (typeof j !== "object" || j === null) throw new Error("not an object");
  return j as RawExtraction;
}

/** One Gemini call (one retry on failure), then validation against the page. Returns null if the model call fails twice. */
export async function extractListing(page: FetchedPage, generate: Generate = defaultGenerate): Promise<RawExtraction | null> {
  const user = `Page URL: ${page.finalUrl}\nPage title: ${page.title}\n\nPAGE TEXT:\n${page.text.slice(0, MAX_TEXT)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return validateAgainstText(parse(await generate(SYSTEM, user, SCHEMA, attempt === 0 ? process.env.GEMINI_EXTRACT_MODEL || DEFAULT_EXTRACT_MODEL : FALLBACK_MODEL)), page);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.warn(`[extract] attempt ${attempt + 1} failed: ${msg.slice(0, 100)}`);
      if (/timeout|timed out|aborted/i.test(msg)) break; // a slow model is not worth waiting for twice
    }
  }
  return null;
}
