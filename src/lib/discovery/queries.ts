// Build search queries from a profile. Owner: Dev B.
import type { OpportunityType } from "@/types";

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
}

export const MAX_QUERIES = 6;

const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" ");

// One or two queries per type, biased toward the sources students actually use.
function queriesFor(type: OpportunityType, p: DiscoveryProfile, year: number): string[] {
  const role = p.preferredRoles[0];
  const skill = p.skills[0];
  const place = p.locations[0] ?? "India";

  switch (type) {
    case "internship":
      return [
        join(p.degree, p.branch, "internship", skill, "India", String(year), "Internshala Unstop"),
        join(role ?? "software intern", place, p.openToRemote && "remote", String(year), "Wellfound careers"),
      ];
    case "job":
      return [
        join(role ?? "software engineer", "fresher job", place, String(year), "Wellfound careers"),
        join(p.degree, p.branch, "graduate hiring India", String(year), "company careers"),
      ];
    case "hackathon":
      return [
        join("hackathon India", String(year), "open registration Devfolio Unstop"),
        join("hackathon", skill, String(year), "Devpost MLH"),
      ];
    case "scholarship":
      return [
        join("scholarship", p.degree, "India", String(year), "Buddy4Study"),
        join("scholarship", p.degree, p.branch, "students apply", String(year)),
      ];
  }
}

// Round-robin so every wanted type gets a query before any type gets a second one.
export function buildQueries(profile: DiscoveryProfile, now = new Date()): DiscoveryQuery[] {
  const year = now.getFullYear();
  const perType = profile.types.map((type) => ({ type, queries: queriesFor(type, profile, year) }));

  const out: DiscoveryQuery[] = [];
  for (const round of [0, 1]) {
    for (const { type, queries } of perType) {
      if (queries[round]) out.push({ type, query: queries[round] });
    }
  }
  return out.slice(0, MAX_QUERIES);
}
