// Pull a few listing links out of an index/category page. Owner: Dev B.
//
// TinyFish Fetch returns page text but strips link targets (checked for markdown, html and json formats), so for this one
// step we read the page's own public HTML with a plain GET (5 s timeout, a single request, no login, no bypassing anything).
// Pages that need JavaScript (e.g. Unstop) simply yield no links and are skipped.
import { classify } from "./urlClassifier";
import { isValidSourceUrl, hostnameOf } from "./sites";

const TIMEOUT_MS = 5_000;
const UA = "Mozilla/5.0 (compatible; OpportunityOS/1.0)";

/** Absolute http(s) hrefs found in the HTML, de-duplicated, in page order. */
export function extractHrefs(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#\s][^"']*)["']/gi)) {
    try {
      const abs = new URL(m[1].replace(/&amp;/g, "&"), baseUrl).toString();
      if (isValidSourceUrl(abs)) out.add(abs);
    } catch {
      // not a URL
    }
  }
  return [...out];
}

/** Up to `max` links from the index page that classify as single-listing pages on the same site. */
export function pickDetailLinks(hrefs: string[], indexUrl: string, max = 3): string[] {
  const host = hostnameOf(indexUrl).replace(/^www\./, "");
  const root = host.split(".").slice(-2).join(".");
  return hrefs.filter((h) => hostnameOf(h).endsWith(root) && h !== indexUrl && classify(h) === "detail").slice(0, max);
}

export async function fetchDetailLinks(indexUrl: string, max = 3): Promise<string[]> {
  try {
    const res = await fetch(indexUrl, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 2_000_000);
    return pickDetailLinks(extractHrefs(html, res.url || indexUrl), indexUrl, max);
  } catch {
    return [];
  }
}
