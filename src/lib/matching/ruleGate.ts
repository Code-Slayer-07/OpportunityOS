// Hard-rule eligibility gate that runs before the LLM. Owner: Dev C.
// Pure and deterministic. CONSERVATIVE: only fails when the listing states a requirement clearly;
// anything unclear passes and is left for Gemini to flag as uncertain.
import { isExpired } from "@/lib/discovery/normalize";
import type { Opportunity, Profile } from "@/types";

export interface GateResult {
  pass: boolean;
  reasons: string[]; // why it failed (empty when it passes)
}

type GateProfile = Pick<
  Profile,
  "degree" | "branch" | "gradYear" | "currentStatus" | "types" | "locations" | "openToRemote"
>;
type GateOpportunity = Pick<Opportunity, "type" | "deadline" | "location" | "remote" | "eligibilityText" | "evidenceSnippets">;

// ---------------------------------------------------------------- degree
const DEGREE_PATTERNS: [string, RegExp][] = [
  ["btech", /\bb\.?\s?tech\b|\bb\.e\.|bachelor of (engineering|technology)/i],
  ["mtech", /\bm\.?\s?tech\b|master of technology/i],
  ["bca", /\bbca\b|bachelor of computer applications?/i],
  ["bsc", /\bb\.?\s?sc\b|bachelor of science/i],
  ["mca", /\bmca\b|master of computer applications?/i],
  ["mba", /\bmba\b|\bpgdm\b/i],
];
const ANY_DEGREE = /\bany (degree|stream|discipline|branch)\b|\ball (degrees|streams|branches|disciplines)\b|\bregardless of\b/i;

const DEGREE_BY_LABEL: Record<string, string> = {
  "b.tech": "btech",
  "m.tech": "mtech",
  bca: "bca",
  "b.sc": "bsc",
  mba: "mba",
};

// ---------------------------------------------------------------- branch
// cs and it are one group: listings that say "CSE/IT" or "computer science" rarely exclude either.
const BRANCH_PATTERNS: [string, RegExp][] = [
  ["computing", /\bcse\b|computer science|information technology|\bcomputer engineering\b|\bsoftware engineering\b|\bai\s?&?\s?ml\b|\bdata science\b/i],
  ["electronics", /\bece\b|\beee\b|\beie\b|electronics|electrical/i],
  ["mechanical", /\bmechanical\b|\bmech\b/i],
  ["civil", /\bcivil\b/i],
  ["chemical", /\bchemical\b/i],
];

const detect = (patterns: [string, RegExp][], text: string) =>
  new Set(patterns.filter(([, re]) => re.test(text)).map(([key]) => key));

// ------------------------------------------------------------ graduation
const YEAR_KEYWORDS = /batch|pass[- ]?outs?|graduat\w*|class of/gi;

// Years the listing ties to a batch/graduation ("2026 batch", "graduating in 2025 or 2026").
export function batchYears(text: string): Set<number> {
  const years = new Set<number>();
  for (const m of text.matchAll(YEAR_KEYWORDS)) {
    const start = Math.max(0, (m.index ?? 0) - 40);
    const window = text.slice(start, (m.index ?? 0) + m[0].length + 40);
    for (const y of window.matchAll(/\b(20\d{2})\b/g)) years.add(Number(y[1]));
  }
  return years;
}

const GENERIC_LOCATION = /\b(india|pan[- ]?india|anywhere|online|virtual|global|worldwide|work from home|wfh)\b/i;

export function passesGate(profile: GateProfile, opp: GateOpportunity, now = new Date()): GateResult {
  const reasons: string[] = [];
  const text = [opp.eligibilityText, ...opp.evidenceSnippets].join(" \n ");

  // Type
  if (profile.types.length > 0 && !profile.types.includes(opp.type)) {
    reasons.push(`Type "${opp.type}" is not one you are looking for`);
  }

  // Deadline (null = unknown = pass)
  if (isExpired(opp.deadline, now)) reasons.push("Deadline has passed");

  // Location: only enforced for internships/jobs; hackathons and scholarships are usually open or travel-friendly.
  if (opp.type === "internship" || opp.type === "job") {
    const loc = opp.location.trim();
    const remoteOk = opp.remote && profile.openToRemote;
    const unknown = !loc || GENERIC_LOCATION.test(loc) || profile.locations.length === 0;
    const near = profile.locations.some((l) => loc.toLowerCase().includes(l.trim().toLowerCase()));
    if (!remoteOk && !unknown && !near) reasons.push(`Location "${loc}" does not match your locations`);
  }

  // Degree (only when the listing names degrees and doesn't say "any")
  if (text && !ANY_DEGREE.test(text)) {
    const wanted = detect(DEGREE_PATTERNS, text);
    const mine = DEGREE_BY_LABEL[profile.degree.toLowerCase()];
    if (wanted.size > 0 && mine && !wanted.has(mine)) {
      reasons.push(`Listing asks for ${[...wanted].join("/")}, you have ${profile.degree}`);
    }

    // Branch (only when the listing names branches and doesn't say "all branches")
    const branches = detect(BRANCH_PATTERNS, text);
    const myBranches = detect(BRANCH_PATTERNS, profile.branch);
    if (branches.size > 0 && myBranches.size > 0 && ![...myBranches].some((b) => branches.has(b))) {
      reasons.push(`Listing asks for ${[...branches].join("/")} branches, you are in ${profile.branch}`);
    }
  }

  // Graduation year / "final year"
  if (text) {
    const years = batchYears(text);
    if (years.size > 0 && profile.gradYear && !years.has(profile.gradYear)) {
      reasons.push(`Listing is for the ${[...years].sort().join("/")} batch, you graduate in ${profile.gradYear}`);
    }
    if (/\bfinal[- ]year\b/i.test(text) && !/pre[- ]?final/i.test(text)) {
      const early = ["1st year", "2nd year"].includes(profile.currentStatus);
      const far = profile.gradYear > now.getFullYear() + 1;
      if (early || far) reasons.push("Listing is for final-year students");
    }
  }

  return { pass: reasons.length === 0, reasons };
}
