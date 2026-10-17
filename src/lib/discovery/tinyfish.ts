// TinyFish client (server only). Owner: Dev B.
// Docs: Search GET  https://api.search.tinyfish.ai?query=...   (header X-API-Key)
//       Fetch  POST https://api.fetch.tinyfish.ai              body { urls: string[<=10], format: "markdown" }
//              -> { results: [{ url, final_url, title, text, ... }], errors: [{ url, error }] }

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FetchedPage {
  url: string;
  /** URL after redirects. This is what we store as sourceUrl. */
  finalUrl: string;
  title: string;
  /** Page text as markdown. */
  text: string;
}

export interface FetchBatch {
  pages: FetchedPage[];
  errors: { url: string; error: string }[];
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
const FETCH_TIMEOUT_MS = 45_000;
export const FETCH_BATCH_SIZE = 10;

const searchUrl = () => process.env.TINYFISH_SEARCH_URL || "https://api.search.tinyfish.ai";
const fetchUrl = () => process.env.TINYFISH_FETCH_URL || "https://api.fetch.tinyfish.ai";

function apiKey() {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new TinyFishError("TINYFISH_API_KEY is not set");
  return key;
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

// fetch + JSON with a timeout and one retry on network errors, timeouts, 429 and 5xx. 4xx fails immediately.
async function callJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let lastError: TinyFishError | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.json();

      const body = (await res.text().catch(() => "")).slice(0, 200);
      lastError = new TinyFishError(`TinyFish responded ${res.status}: ${body}`, res.status);
      if (res.status !== 429 && res.status < 500) throw lastError;
    } catch (e) {
      if (e instanceof TinyFishError && e === lastError && e.status && e.status !== 429 && e.status < 500) throw e;
      if (isTimeout(e)) lastError = new TinyFishError(`TinyFish request timed out after ${timeoutMs}ms`);
      else if (!(e instanceof TinyFishError)) lastError = new TinyFishError(`TinyFish request failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw lastError ?? new TinyFishError("TinyFish request failed");
}

// `afterDate` (YYYY-MM-DD) asks the search engine for recent pages only, so old closed listings rank lower.
export async function search(query: string, { afterDate }: { afterDate?: string } = {}): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query });
  if (afterDate) params.set("after_date", afterDate);
  const url = `${searchUrl()}?${params}`;
  const json = (await callJson(url, { headers: { "X-API-Key": apiKey() } }, SEARCH_TIMEOUT_MS)) as {
    results?: { title?: string; url?: string; snippet?: string }[];
  };
  return (json.results ?? [])
    .filter((r): r is { title?: string; url: string; snippet?: string } => typeof r.url === "string")
    .map((r) => ({ title: r.title ?? "", url: r.url, snippet: r.snippet ?? "" }));
}

/** Fetch up to 10 pages in one request. Per-URL failures come back in `errors`; the batch itself only throws on transport errors. */
export async function fetchPages(urls: string[]): Promise<FetchBatch> {
  if (urls.length === 0) return { pages: [], errors: [] };
  const json = (await callJson(
    fetchUrl(),
    {
      method: "POST",
      headers: { "X-API-Key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urls.slice(0, FETCH_BATCH_SIZE), format: "markdown" }),
    },
    FETCH_TIMEOUT_MS,
  )) as {
    results?: { url?: string; final_url?: string; title?: string; text?: unknown }[];
    errors?: { url?: string; error?: string }[];
  };

  return {
    pages: (json.results ?? [])
      .filter((r) => typeof r.url === "string" && typeof r.text === "string")
      .map((r) => ({ url: r.url!, finalUrl: r.final_url || r.url!, title: r.title ?? "", text: r.text as string })),
    errors: (json.errors ?? []).map((e) => ({ url: e.url ?? "", error: e.error ?? "unknown error" })),
  };
}
