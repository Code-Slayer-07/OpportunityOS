// Link liveness check for freshly extracted records. Owner: Dev B.
const TIMEOUT_MS = 5_000;
const UA = "Mozilla/5.0 (compatible; OpportunityOS-linkcheck/1.0)";

export interface LiveResult {
  /** HTTP status of the final response, or null if the page could not be reached at all. */
  status: number | null;
  /** True only for 404/410. Other errors (403 bot checks, timeouts) do not prove the page is gone. */
  dead: boolean;
}

async function once(url: string, method: "HEAD" | "GET"): Promise<number | null> {
  try {
    const res = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": UA } });
    void res.body?.cancel().catch(() => {});
    return res.status;
  } catch {
    return null;
  }
}

/** HEAD first; if that fails or is rejected, GET. 5 s timeout each. */
export async function checkLive(url: string): Promise<LiveResult> {
  let status = await once(url, "HEAD");
  if (status === null || status >= 400) status = (await once(url, "GET")) ?? status;
  return { status, dead: status === 404 || status === 410 };
}
