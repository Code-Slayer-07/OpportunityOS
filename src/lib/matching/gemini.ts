// Gemini matcher (server only). Owner: Dev C.
// API: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//      header x-goog-api-key; JSON mode via generationConfig.responseMimeType + responseSchema.
import type { Evidence, Opportunity, Profile } from "@/types";
import { ruleBasedMatch, type MatchResult } from "./fallback";
import { acquireSlot, retryAfterMs } from "./rateLimit";
import { BATCH_SYSTEM_PROMPT, buildBatchPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { BATCH_RESPONSE_SCHEMA, GEMINI_RESPONSE_SCHEMA, batchOutputSchema, matchOutputSchema, type MatchOutput } from "./schema";

const TIMEOUT_MS = 15_000;
// Scoring and extraction use different models on purpose: the free tier limits requests per minute per model, so
// two models give two separate allowances. Override with GEMINI_MODEL / GEMINI_EXTRACT_MODEL.
export const DEFAULT_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_EXTRACT_MODEL = "gemini-3.5-flash-lite";

export type Generate = (systemPrompt: string, userPrompt: string) => Promise<string>;

// Calls Gemini in JSON mode and returns the raw JSON text. Throws on timeout, HTTP error or empty output.
// Also used by discovery extraction, which passes its own response schema.
export async function generateJson(systemPrompt: string, userPrompt: string, responseSchema: object = GEMINI_RESPONSE_SCHEMA, modelOverride?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = modelOverride || process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema },
  });
  const send = async () => {
    await acquireSlot(model); // stay under the per-model requests-per-minute limit
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  };

  let res = await send();
  if (res.status === 429) {
    // Quota exceeded: if Gemini says how long to wait and it is short, wait once and try again.
    const text = await res.text().catch(() => "");
    const wait = retryAfterMs(text);
    if (wait === null || wait > 20_000) throw new Error(`Gemini responded 429: ${text.slice(0, 160)}`);
    await new Promise((r) => setTimeout(r, wait));
    res = await send();
  }
  if (!res.ok) throw new Error(`Gemini responded ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no content");
  return text;
}

export const callGemini: Generate = (systemPrompt, userPrompt) => generateJson(systemPrompt, userPrompt);

// Strip markdown fences some models add despite JSON mode, then parse + validate.
export function parseOutput(text: string): MatchOutput {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return matchOutputSchema.parse(JSON.parse(body));
}

const norm = (s: string) => s.toLowerCase().replace(/[\s"'“”‘’.…]+/g, " ").trim();

// Enforce the output contract. sourceUrl/fetchedAt come from the opportunity, never from the model.
export function finalizeMatch(out: MatchOutput, opp: Opportunity): MatchResult {
  const source = norm([opp.title, opp.org, opp.eligibilityText, opp.location, opp.reward ?? "", ...opp.evidenceSnippets].join(" "));
  const stamp = { sourceUrl: opp.sourceUrl, fetchedAt: opp.fetchedAt };
  const gaps = out.gaps.map((g) => g.trim()).filter(Boolean);

  // Keep only quotes that really appear in the opportunity text.
  const verbatim = out.evidenceMap.filter((e) => norm(e.quote).length > 0 && source.includes(norm(e.quote)));
  if (verbatim.length < out.evidenceMap.length) gaps.push("Some AI-cited evidence could not be verified against the listing and was removed");
  let evidenceMap: Evidence[] = verbatim.map((e) => ({ ...e, ...stamp }));

  if (evidenceMap.length === 0) {
    const quote = opp.evidenceSnippets[0] ?? opp.eligibilityText.slice(0, 240);
    if (quote) evidenceMap = [{ requirement: "Listing eligibility", profileField: "profile", quote, ...stamp }];
    else gaps.push("The listing has no quotable eligibility text");
  }

  return {
    score: out.score,
    reason: out.reason,
    evidenceMap,
    gaps: gaps.length > 0 ? gaps : ["No gaps found"],
    // No eligibility text at all means we cannot be sure either way.
    eligibilityUncertain: out.eligibilityUncertain || (!opp.eligibilityText && opp.evidenceSnippets.length === 0),
  };
}

// Never throws: two attempts at Gemini, then a rule-based score.
export async function matchOpportunity(
  profile: Profile,
  opp: Opportunity,
  generate: Generate = callGemini,
): Promise<MatchResult & { source: "ai" | "rules" }> {
  const userPrompt = buildUserPrompt(profile, opp);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { ...finalizeMatch(parseOutput(await generate(SYSTEM_PROMPT, userPrompt)), opp), source: "ai" };
    } catch (e) {
      console.warn(`[match] gemini attempt ${attempt + 1} failed: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`);
    }
  }
  return { ...ruleBasedMatch(profile, opp), source: "rules" };
}

export type Scored = MatchResult & { source: "ai" | "rules" };
export type GenerateBatch = (system: string, user: string) => Promise<string>;
const callGeminiBatch: GenerateBatch = (system, user) => generateJson(system, user, BATCH_RESPONSE_SCHEMA);

export const BATCH_SIZE = 4;
const HEDGE_MS = 4_500; // a batch normally answers in about 3 s; if it has not by now, send a second request and use whichever succeeds first

/**
 * Run `fn`; if it has not finished after `delayMs`, or it fails, run it once more. The first success wins.
 * Rejects only when both attempts failed (this is the "one retry", started early instead of after a long timeout).
 */
export function hedged<T>(fn: () => Promise<T>, delayMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let launched = 0;
    let failed = 0;
    let settled = false;
    const launch = () => {
      launched++;
      fn().then(
        (v) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          failed++;
          if (settled) return;
          if (launched < 2) return launch();
          if (failed >= launched) {
            settled = true;
            clearTimeout(timer);
            reject(e);
          }
        },
      );
    };
    launch();
    // Declared after launch(); the attempts settle in later microtasks, so the timer exists by then.
    const timer = setTimeout(() => {
      if (!settled && launched < 2) launch();
    }, delayMs);
  });
}

/**
 * Score several opportunities with ONE Gemini call (one retry), validated per item.
 * - Transport failure (timeout, offline, 5xx twice): every item gets the rule-based fallback straight away; no per-item calls.
 * - Bad JSON or missing/invalid items: only those items are scored again individually.
 * Never throws.
 */
export async function matchBatch(
  profile: Profile,
  opps: Opportunity[],
  generate: GenerateBatch = callGeminiBatch,
  single: Generate = callGemini,
): Promise<Scored[]> {
  if (opps.length === 0) return [];
  const user = buildBatchPrompt(profile, opps);
  const out: (Scored | undefined)[] = new Array(opps.length).fill(undefined);

  let text: string | null = null;
  try {
    text = await hedged(() => generate(BATCH_SYSTEM_PROMPT, user), HEDGE_MS);
  } catch (e) {
    console.warn(`[match] batch failed: ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`);
  }
  if (text === null) return opps.map((o) => ({ ...ruleBasedMatch(profile, o), source: "rules" as const }));

  try {
    const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const raw = JSON.parse(body) as { results?: unknown[] };
    for (const item of Array.isArray(raw.results) ? raw.results : []) {
      const parsed = batchOutputSchema.shape.results.element.safeParse(item);
      if (!parsed.success || parsed.data.id < 0 || parsed.data.id >= opps.length || out[parsed.data.id]) continue;
      const { id, ...rest } = parsed.data;
      out[id] = { ...finalizeMatch(rest, opps[id]), source: "ai" };
    }
  } catch {
    // unparseable batch: every item falls through to the individual path below
  }

  return Promise.all(out.map((r, i) => r ?? matchOpportunity(profile, opps[i], single)));
}
