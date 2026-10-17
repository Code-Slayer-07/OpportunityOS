// Shared domain types (PRD unified model). Owner: Dev A. Change via PR; all devs depend on this.

export type OpportunityType = "internship" | "job" | "hackathon" | "scholarship";

export const APPLICATION_STATUSES = ["Saved", "Applying", "Applied", "Interview", "Result"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// "expired": deadline passed. "incomplete": missing key fields or unparseable deadline.
export type OpportunityFlag = "expired" | "incomplete";

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
