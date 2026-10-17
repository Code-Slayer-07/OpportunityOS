// Build site-targeted search queries from a profile. Owner: Dev B.
import type { OpportunityType } from "@/types";
import { siteById, type SiteConfig } from "./sites";

export interface DiscoveryProfile {
  degree: string;
  branch: string;
  skills: string[];
  preferredRoles: string[];
  types: OpportunityType[];
  locations: string[];
  openToRemote: boolean;
}

export interface DiscoveryQuery {
  type: OpportunityType;
  query: string;
  /** Site ids the query targets. */
  sites: string[];
}

export const MAX_QUERIES = 6;
const SITES_PER_QUERY = 3;

// Sources per type, ordered by how reliably their listing pages extract (public pages first).
export const SOURCES: Record<OpportunityType, string[]> = {
  internship: ["internshala", "unstop", "linkedin", "wellfound", "foundit", "careers", "letsintern", "aicte", "naukri", "indeed", "glassdoor"],
  job: ["unstop", "linkedin", "wellfound", "foundit", "cutshort", "careers", "naukri", "indeed", "instahyre", "hackerearth"],
  hackathon: ["unstop", "devfolio", "hack2skill", "devpost", "hackerearth", "kaggle", "mlh"],
  scholarship: ["buddy4study", "scholars4dev", "unstop", "foundations", "vidyasaarathi", "nsp"],
};

const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" ");

const siteClause = (sites: SiteConfig[], type: OpportunityType) => `(${sites.map((s) => `site:${s.queryDomains?.[type] ?? s.queryDomain}`).join(" OR ")})`;

function topic(type: OpportunityType, p: DiscoveryProfile, year: number): string {
  const role = p.preferredRoles[0];
  const skill = p.skills[0];
  switch (type) {
    case "internship":
      return join(role ?? "software", "internship", skill, "apply India", String(year));
    case "job":
      return join(role ?? "software engineer", "fresher job apply India", String(year));
    case "hackathon":
      return join("hackathon India", String(year), "apply registration open");
    case "scholarship":
      return join("scholarship", p.degree, "students India apply", String(year));
  }
}

/**
 * Up to MAX_QUERIES queries. Per type, the first query targets ONE "anchor" site (so a site cannot be crowded out by
 * the others in a multi-site query) and the second a group of 3 other sites. `seed` rotates the anchor and the group,
 * so successive runs cover different platforms. Every wanted type gets a query before any type gets a second one.
 */
export function buildQueries(profile: DiscoveryProfile, { seed = 0, now = new Date() }: { seed?: number; now?: Date } = {}): DiscoveryQuery[] {
  const year = now.getFullYear();
  const wanted = profile.types;
  const perType = Math.max(1, Math.floor(MAX_QUERIES / Math.max(1, wanted.length)));

  const out: DiscoveryQuery[] = [];
  for (let round = 0; round < perType; round++) {
    for (const type of wanted) {
      const pool = SOURCES[type].map(siteById).filter((s): s is SiteConfig => !!s);
      if (pool.length === 0) continue;
      const anchorPool = pool.filter((s) => !s.lowYield).slice(0, 6); // the platforms whose pages extract cleanly
      if (anchorPool.length === 0) anchorPool.push(pool[0]);
      const anchor = anchorPool[seed % anchorPool.length];
      let group: SiteConfig[];
      if (round === 0) {
        group = [anchor];
      } else {
        // Low-yield portals only join every third run, and only in the last slot.
        const good = pool.filter((s) => s.id !== anchor.id && !s.lowYield);
        const low = pool.filter((s) => s.id !== anchor.id && s.lowYield);
        const start = (seed * SITES_PER_QUERY) % Math.max(1, good.length);
        group = Array.from({ length: Math.min(SITES_PER_QUERY, good.length) }, (_, i) => good[(start + i) % good.length]);
        if (low.length > 0 && seed % 3 === 0) group = [...group.slice(0, SITES_PER_QUERY - 1), low[Math.floor(seed / 3) % low.length]];
        if (group.length === 0) group = [anchor];
      }
      out.push({ type, query: `${siteClause(group, type)} ${topic(type, profile, year)}`, sites: group.map((g) => g.id) });
    }
  }
  return out.slice(0, MAX_QUERIES);
}
