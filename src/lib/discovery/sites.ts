// Per-site configuration and URL validation. Owner: Dev B.
// Pure (no server imports) so the UI can use siteName / hostname / favicon helpers too.
import type { OpportunityType } from "@/types";

export interface SiteConfig {
  id: string;
  name: string;
  /** Matches the hostname (no port). */
  host: RegExp;
  types: OpportunityType[];
  /**
   * "public": pages normally load without an account.
   * "gated": often shows a login wall or bot check. We still try, and skip (never bypass) when blocked.
   */
  extractable: "public" | "gated";
  /** Domain (optionally with a path prefix that only listing pages share) used in `site:` queries. */
  queryDomain: string;
  /** Pages mostly are not single listings, are blocked, or cannot be fetched: used less often. */
  lowYield?: boolean;
  /** Per-type override of queryDomain. */
  queryDomains?: Partial<Record<OpportunityType, string>>;
  /** Path (+search) of a single listing. */
  detail?: RegExp;
  /** Path of a search-results or category page (one URL = many listings, so not extracted). */
  index?: RegExp;
  /** Path of articles/blogs about listings. */
  skip?: RegExp;
}

export const SITES: SiteConfig[] = [
  { id: "internshala", name: "Internshala", host: /(^|\.)internshala\.com$/, types: ["internship", "job"], extractable: "public", queryDomain: "internshala.com", queryDomains: { internship: "internshala.com/internship/detail", job: "internshala.com/job/detail" }, detail: /^\/(internship|job)\/detail\//, index: /^\/(internships|jobs|fresher-jobs)/, skip: /^\/(blog|stories|student)/ },
  { id: "unstop", name: "Unstop", host: /(^|\.)unstop\.com$/, types: ["internship", "job", "hackathon", "scholarship"], extractable: "public", queryDomain: "unstop.com", queryDomains: { internship: "unstop.com/internships", job: "unstop.com/jobs", hackathon: "unstop.com/hackathons", scholarship: "unstop.com/scholarships" }, detail: /^\/(hackathons|internships|jobs|competitions|scholarships|quiz|workshops-webinars|p)\/[^/]+-\d{5,}\/?$/, index: /^\/(hackathons|internships?|jobs|competitions|scholarships|all-opportunities)\/?(\?|$|[a-z-]+\/?$)/, skip: /^\/(blog|learn|courses)/ },
  { id: "linkedin", name: "LinkedIn", host: /(^|\.)linkedin\.com$/, types: ["internship", "job"], extractable: "gated", queryDomain: "linkedin.com/jobs/view", detail: /^\/jobs\/view\/.*\d{6,}/, index: /^\/jobs\/(search|collections)/, skip: /^\/(in|company|pulse|posts|feed|learning)\//},
  { id: "wellfound", name: "Wellfound", host: /(^|\.)wellfound\.com$/, types: ["internship", "job"], extractable: "gated", queryDomain: "wellfound.com/jobs", detail: /^\/(company\/[^/]+\/)?jobs\/\d+/, index: /^\/(role|location|jobs\/?$|startups|l\/)/ },
  { id: "naukri", lowYield: true, name: "Naukri", host: /(^|\.)naukri\.com$/, types: ["job", "internship"], extractable: "gated", queryDomain: "naukri.com/job-listings", detail: /^\/job-listings-/, index: /-jobs(-in-[a-z-]+)?\/?$|^\/(jobs-in|[a-z-]+-jobs)/ },
  { id: "indeed", lowYield: true, name: "Indeed", host: /(^|\.)indeed\.com$/, types: ["job", "internship"], extractable: "gated", queryDomain: "in.indeed.com/viewjob", detail: /^\/(viewjob|rc\/clk)/, index: /^\/(jobs|q-)/ },
  { id: "glassdoor", lowYield: true, name: "Glassdoor", host: /(^|\.)glassdoor\.(com|co\.in)$/, types: ["job", "internship"], extractable: "gated", queryDomain: "glassdoor.co.in/job-listing", detail: /job-listing\//, index: /^\/(Job|Jobs)\// },
  { id: "instahyre", lowYield: true, name: "Instahyre", host: /(^|\.)instahyre\.com$/, types: ["job"], extractable: "gated", queryDomain: "instahyre.com" },
  { id: "foundit", lowYield: true, name: "Foundit", host: /(^|\.)foundit\.in$/, types: ["job", "internship"], extractable: "public", queryDomain: "foundit.in/job", detail: /^\/job\//, index: /^\/(search|srp)/ },
  { id: "cutshort", name: "Cutshort", host: /(^|\.)cutshort\.io$/, types: ["job"], extractable: "public", queryDomain: "cutshort.io/job-openings", detail: /^\/job-openings\/|^\/job\//, index: /^\/(jobs|search)/ },
  { id: "aicte", lowYield: true, name: "AICTE Internship", host: /(^|\.)internship\.aicte-india\.org$/, types: ["internship"], extractable: "public", queryDomain: "internship.aicte-india.org" },
  { id: "letsintern", name: "LetsIntern", host: /(^|\.)(letsintern|twenty19)\.com$/, types: ["internship"], extractable: "public", queryDomain: "letsintern.com" },
  { id: "careers", name: "Company careers", host: /^(careers\.google\.com|www\.google\.com|careers\.microsoft\.com|jobs\.careers\.microsoft\.com|www\.amazon\.jobs|amazon\.jobs|careers\.infosys\.com|www\.tcs\.com|ibegin\.tcs\.com|careers\.tcs\.com)$/, types: ["internship", "job"], extractable: "public", queryDomain: "careers.google.com", detail: /\/(jobs\/results\/\d+|jobs\/\d+|job\/\d+|jobs\/results\/[^/]*\d{6,})/ },
  { id: "devfolio", name: "Devfolio", host: /(^|\.)devfolio\.co$/, types: ["hackathon"], extractable: "public", queryDomain: "devfolio.co" },
  { id: "devpost", name: "Devpost", host: /(^|\.)devpost\.com$/, types: ["hackathon"], extractable: "public", queryDomain: "devpost.com" },
  { id: "mlh", name: "MLH", host: /(^|\.)mlh\.io$/, types: ["hackathon"], extractable: "public", queryDomain: "mlh.io", index: /^\/(seasons|events)/ },
  { id: "hackerearth", name: "HackerEarth", host: /(^|\.)hackerearth\.com$/, types: ["hackathon", "job"], extractable: "public", queryDomain: "hackerearth.com/challenges/hackathon", detail: /^\/(community\/)?challenges\/(hackathon|competitive|hiring)\/[^/]+\/?$/, index: /^\/challenges\/?$/ },
  { id: "hack2skill", name: "Hack2skill", host: /(^|\.)hack2skill\.com$/, types: ["hackathon"], extractable: "public", queryDomain: "hack2skill.com/event", detail: /^\/(event|hackathon)\/[^/]+/, index: /^\/(hackathons?|events?)\/?$/ },
  { id: "kaggle", lowYield: true, name: "Kaggle", host: /(^|\.)kaggle\.com$/, types: ["hackathon"], extractable: "public", queryDomain: "kaggle.com/competitions", detail: /^\/competitions\/[^/]+\/?$/, index: /^\/(competitions\/?$|c\/)/ },
  { id: "buddy4study", name: "Buddy4Study", host: /(^|\.)buddy4study\.com$/, types: ["scholarship"], extractable: "public", queryDomain: "buddy4study.com/page", detail: /^\/(page|scholarship)\/[^/]+/, index: /^\/scholarships/, skip: /^\/(article|blog)/ },
  { id: "nsp", lowYield: true, name: "National Scholarship Portal", host: /(^|\.)scholarships\.gov\.in$/, types: ["scholarship"], extractable: "public", queryDomain: "scholarships.gov.in" },
  { id: "vidyasaarathi", lowYield: true, name: "Vidyasaarathi", host: /(^|\.)vidyasaarathi\.co\.in$/, types: ["scholarship"], extractable: "public", queryDomain: "vidyasaarathi.co.in" },
  { id: "scholars4dev", name: "Scholars4Dev", host: /(^|\.)scholars4dev\.com$/, types: ["scholarship"], extractable: "public", queryDomain: "scholars4dev.com", detail: /^\/\d+\/[^/]+\/?$/, index: /^\/(category|tag|page)\//},
  { id: "foundations", name: "Foundation scholarships", host: /(^|\.)(tatatrusts\.org|reliancefoundation\.org|scholarships\.reliancefoundation\.org|aicte-india\.org|startup\.google\.com|buildyourfuture\.withgoogle\.com|microsoft\.com)$/, types: ["scholarship"], extractable: "public", queryDomain: "reliancefoundation.org" },
];

const FAKE_HOST = /(^|\.)(example\.(com|org|net)|localhost|invalid)$|\.test$|^127\.|^0\.0\.0\.0$|^\[?::1\]?$/i;
const IP_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[.*\]$/;

/** Rejects example.com, localhost, *.test, empty and non-http(s) URLs. */
export function isValidSourceUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname && !FAKE_HOST.test(u.hostname) && !IP_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export const siteById = (id: string) => SITES.find((s) => s.id === id);

export function siteForUrl(url: string): SiteConfig | null {
  const host = hostnameOf(url);
  return SITES.find((s) => s.host.test(host)) ?? null;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Internshala" for known sites, otherwise a readable form of the hostname ("careers.acme.com" -> "Acme"). */
export function siteName(url: string): string {
  const known = siteForUrl(url);
  if (known) return known.name;
  const parts = hostnameOf(url).replace(/^(www|careers|jobs|in)\./, "").split(".");
  return titleCase(parts.length > 1 ? parts[parts.length - 2] : parts[0] || "Unknown");
}

// Favicons exist for a platform's main domain, not for every sub-domain (e.g. hyperfusion.devfolio.co -> devfolio.co).
export function faviconUrl(url: string): string {
  const host = hostnameOf(url);
  const main = siteForUrl(url)?.queryDomain.split("/")[0] ?? "";
  const domain = main && host.endsWith(main) ? main : host;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
