// TinyFish client (server only). Owner: Dev B.
// Docs: Search  GET  https://api.search.tinyfish.ai?query=...      (header X-API-Key)
//       Agent   POST https://agent.tinyfish.ai/v1/automation/run  body { url, goal, output_schema }
// Fetch is not used: it returns raw page text, not structured fields.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Raw, unvalidated fields as returned by the agent. normalize.ts cleans these.
export interface RawExtraction {
  title?: string | null;
  org?: string | null;
  type?: string | null;
  eligibilityText?: string | null;
  deadline?: string | null;
  location?: string | null;
  remote?: boolean | null;
  reward?: string | null;
  evidenceSnippets?: string[] | null;
}

export class TinyFishError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TinyFishError";
  }
}

const SEARCH_TIMEOUT_MS = 15_000;
// The agent drives a real browser, so it needs far longer than a search call.
const EXTRACT_TIMEOUT_MS = Number(process.env.TINYFISH_EXTRACT_TIMEOUT_MS) || 120_000;
const EXTRACT_MAX_SECONDS = 100;

const searchUrl = () => process.env.TINYFISH_SEARCH_URL || "https://api.search.tinyfish.ai";
const agentUrl = () => process.env.TINYFISH_AGENT_URL || "https://agent.tinyfish.ai/v1/automation/run";

function apiKey() {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new TinyFishError("TINYFISH_API_KEY is not set");
  return key;
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

// fetch + JSON with a timeout and one retry on network errors, 429 and 5xx.
async function callJson(url: string, init: RequestInit, timeoutMs: number, retryOnTimeout: boolean): Promise<unknown> {
  let lastError: TinyFishError | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.json();

      const body = (await res.text().catch(() => "")).slice(0, 200);
      lastError = new TinyFishError(`TinyFish responded ${res.status}: ${body}`, res.status);
      if (res.status !== 429 && res.status < 500) throw lastError; // client errors won't improve on retry
    } catch (e) {
      if (e instanceof TinyFishError && e === lastError && e.status && e.status !== 429 && e.status < 500) throw e;
      if (isTimeout(e)) {
        lastError = new TinyFishError(`TinyFish request timed out after ${timeoutMs}ms`);
        if (!retryOnTimeout) throw lastError;
      } else if (!(e instanceof TinyFishError)) {
        lastError = new TinyFishError(`TinyFish request failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  throw lastError ?? new TinyFishError("TinyFish request failed");
}

export async function search(query: string): Promise<SearchResult[]> {
  const url = `${searchUrl()}?${new URLSearchParams({ query })}`;
  const json = (await callJson(url, { headers: { "X-API-Key": apiKey() } }, SEARCH_TIMEOUT_MS, true)) as {
    results?: { title?: string; url?: string; snippet?: string }[];
  };
  return (json.results ?? [])
    .filter((r): r is { title?: string; url: string; snippet?: string } => typeof r.url === "string")
    .map((r) => ({ title: r.title ?? "", url: r.url, snippet: r.snippet ?? "" }));
}

// Only keywords on TinyFish's structured-output allowlist (no additionalProperties/oneOf/etc).
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    org: { type: "string" },
    type: { type: "string", enum: ["internship", "job", "hackathon", "scholarship"] },
    eligibilityText: { type: "string", nullable: true },
    deadline: { type: "string", nullable: true },
    location: { type: "string", nullable: true },
    remote: { type: "boolean", nullable: true },
    reward: { type: "string", nullable: true },
    evidenceSnippets: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
  required: ["title", "org", "type", "evidenceSnippets"],
  propertyOrdering: [
    "title",
    "org",
    "type",
    "eligibilityText",
    "deadline",
    "location",
    "remote",
    "reward",
    "evidenceSnippets",
  ],
};

const GOAL = `Read ONLY this page; do not navigate to other pages unless needed to see the eligibility or deadline on this listing.
If the page is a single internship, job, hackathon or scholarship, extract:
- title, org (the organisation offering it), type (internship | job | hackathon | scholarship)
- eligibilityText: who may apply, copied from the page
- deadline: the application/registration deadline as YYYY-MM-DD if a full date is shown, otherwise the text exactly as shown
- location, remote (true/false), reward (stipend, salary, prize or award amount)
- evidenceSnippets: up to 5 short sentences copied VERBATIM from the page that state eligibility or requirements.
Never guess or invent values. If a field is not on the page, return null for it (and an empty list for evidenceSnippets).
If the page is not a single opportunity (for example a search or listing index), return title "" and org "".`;

export async function extract(url: string): Promise<RawExtraction> {
  const json = (await callJson(
    agentUrl(),
    {
      method: "POST",
      headers: { "X-API-Key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        goal: GOAL,
        output_schema: OUTPUT_SCHEMA,
        agent_config: { max_duration_seconds: EXTRACT_MAX_SECONDS },
      }),
    },
    EXTRACT_TIMEOUT_MS,
    false, // a timed-out browser run is not worth repeating
  )) as { status?: string; result?: unknown; error?: { message?: string } | null };

  if (json.status === "FAILED" || json.result == null) {
    throw new TinyFishError(`Extraction failed: ${json.error?.message ?? "no result"}`);
  }
  const result = typeof json.result === "string" ? JSON.parse(json.result) : json.result;
  if (typeof result !== "object" || result === null) throw new TinyFishError("Extraction returned an unexpected result");
  return result as RawExtraction;
}
