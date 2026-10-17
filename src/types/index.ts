// Shared domain types (PRD unified model). Owner: Dev A. Change via PR; all devs depend on this.

export type OpportunityType = "internship" | "job" | "hackathon" | "scholarship";

export const APPLICATION_STATUSES = ["Saved", "Applying", "Applied", "Interview", "Result"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

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

export interface Application {
  id: string;
  opportunityId: string;
  status: ApplicationStatus;
  savedAt: string;
  updatedAt: string;
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
