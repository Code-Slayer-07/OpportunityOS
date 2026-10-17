// Is a URL a single listing page, a listing index, or something to skip? Owner: Dev B.
// Used before spending a fetch/extraction on a URL: category, search, location and article pages are rejected.
import { isValidSourceUrl, siteForUrl } from "./sites";

export type UrlClass = "detail" | "index" | "skip" | "unknown";

// Social/video/blog hosts never hold a single listing.
const NEVER = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|instagram\.com|twitter\.com|x\.com|reddit\.com|quora\.com|medium\.com|pinterest\.com|wikipedia\.org|t\.me|whatsapp\.com)$/;
// Articles about listings ("top 10 internships ...").
const ARTICLE = /\/(blog|blogs|article|articles|news|guide|learn|stories|post|posts)\/|\/(top|best)-\d+|(^|\/)(top|best)-[a-z-]*(internships|hackathons|scholarships|jobs)/i;


/** Detailed classification: "skip" = never a listing (social, blog, invalid). */
export function classifyUrl(url: string): UrlClass {
  if (!isValidSourceUrl(url)) return "skip";
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const path = `${u.pathname}${u.search}`;
  // Documents, API endpoints and article pages are never a listing page.
  if (NEVER.test(host) || ARTICLE.test(u.pathname) || /.(pdf|docx?|xlsx?|pptx?|zip)$/i.test(u.pathname) || /^api./.test(host)) return "skip";

  // Devfolio / Devpost: a hackathon is a subdomain; the apex site hosts listings of hackathons.
  const sub = host.match(/^([a-z0-9-]+)\.(devfolio\.co|devpost\.com)$/);
  if (sub) {
    if (["www", "guide", "blog", "help", "docs", "info"].includes(sub[1])) return /hackathons/.test(u.pathname) ? "index" : "skip";
    return /^\/(hackathons|projects|submissions)/.test(u.pathname) && !/overview|^\/$/.test(u.pathname) ? "index" : "detail";
  }
  if (/^(www\.)?(devfolio\.co|devpost\.com)$/.test(host)) return /hackathons/.test(u.pathname) ? "index" : "skip";

  const site = siteForUrl(url);
  if (site) {
    if (site.skip?.test(path)) return "skip";
    if (site.detail?.test(path)) return "detail";
    if (site.index?.test(path)) return "index";
    return "unknown"; // a path we have no pattern for: worth one fetch, extraction rejects non-listings
  }
  // Unknown host (e.g. a company careers page): the bare homepage is never a listing.
  if (u.pathname === "/" || u.pathname === "") return "skip";
  return "unknown";
}

/**
 * "detail": one URL = one opportunity. "index": a category/search/listing page (many opportunities, or not a listing at all),
 * rejected before extraction. "unknown": a site we have no pattern for; worth trying.
 */
export function classify(url: string): "detail" | "index" | "unknown" {
  const c = classifyUrl(url);
  return c === "skip" ? "index" : c;
}
