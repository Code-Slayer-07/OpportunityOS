// Shared domain types (PRD unified model). Owner: Dev A. Change via PR; all devs depend on this.

export type OpportunityType = "internship" | "job" | "hackathon" | "scholarship";

export const APPLICATION_STATUSES = ["Saved", "Applying", "Applied", "Interview", "Result"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// "expired": deadline passed. "incomplete": missing key fields or unparseable deadline.
// "dead_link": the source page returned 404/410 (hidden from results).
export type OpportunityFlag = "expired" | "incomplete" | "dead_link";

export interface Opportunity {
  id?: string;
  type: OpportunityType;
  title: string;
  org: string;
  eligibilityText: string;
  deadline: string | null; // ISO date
  location: string;
  remote: boolean;
  reward: string | null;
  sourceUrl: string;
  fetchedAt: string; // ISO date
  evidenceSnippets: string[];
  flag?: OpportunityFlag | null;
  /** Platform the page belongs to, e.g. "Internshala". */
  sourceSite?: string | null;
  /** Direct apply link when the page exposes one; the UI falls back to sourceUrl. */
  applyUrl?: string | null;
  /** Every stored row came from a real page fetched by our own pipeline. */
  origin?: "live_fetch" | null;
  /** HTTP status of the liveness check on sourceUrl. */
  httpStatus?: number | null;
}

export interface Evidence {
  requirement: string;
  profileField: string;
  quote: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface Match {
  id?: string;
  opportunityId?: string;
  score: number;
  reason: string;
  evidenceMap: Evidence[];
  gaps: string[];
  eligibilityUncertain: boolean;
}

// A match joined with its opportunity, as returned by /api/match.
export interface MatchWithOpportunity extends Match {
  id: string;
  opportunityId: string;
  createdAt: string;
  opportunity: Opportunity;
  /** True for an instant rule-based score that was never AI-scored (shown, labelled, never saved). */
  isFallback?: boolean;
}

export type UrgencyLevel = "red" | "amber" | "green" | "grey" | "none";

export interface Application {
  id: string;
  opportunityId: string;
  status: ApplicationStatus;
  savedAt: string;
  updatedAt: string;
}

// An application joined with its opportunity and match, plus computed urgency/priority (GET /api/applications).
export interface ApplicationItem extends Application {
  opportunity: Opportunity;
  match: { score: number; reason: string } | null;
  urgency: UrgencyLevel;
  daysLeft: number | null;
  priority: number;
}

export interface Profile {
  degree: string;
  branch: string;
  gradYear: number;
  currentStatus: string;
  cgpa?: number;
  skills: string[];
  preferredRoles: string[];
  experienceLevel: string;
  types: OpportunityType[];
  locations: string[];
  openToRemote: boolean;
  availabilityDate?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export type DiscoveryJobStatus = "running" | "done" | "partial" | "failed";
export type DiscoveryStage = "searching" | "extracting" | "matching" | "done";

// Progress of a background "find opportunities" run (GET /api/discover/[jobId]).
export interface DiscoveryJob {
  id: string;
  status: DiscoveryJobStatus;
  stage: DiscoveryStage;
  total: number;
  done: number;
  found: number;
  scored: number;
  warning: string | null;
  error: string | null;
}
