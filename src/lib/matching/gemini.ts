// Gemini matcher (server only). Owner: Dev C.
// API: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//      header x-goog-api-key; JSON mode via generationConfig.responseMimeType + responseSchema.
import type { Evidence, Opportunity, Profile } from "@/types";
import { ruleBasedMatch, type MatchResult } from "./fallback";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { GEMINI_RESPONSE_SCHEMA, matchOutputSchema, type MatchOutput } from "./schema";

const TIMEOUT_MS = 25_000;
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export type Generate = (systemPrompt: string, userPrompt: string) => Promise<string>;

// Calls Gemini and returns the raw JSON text. Throws on timeout, HTTP error or empty output.
export const callGemini: Generate = async (systemPrompt, userPrompt) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gemini responded ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no content");
  return text;
};

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
