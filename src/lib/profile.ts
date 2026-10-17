// profiles row (snake_case) -> Profile (camelCase). Owner: Dev A.
import type { Profile } from "@/types";

export function rowToProfile(r: Record<string, any>): Profile { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    degree: r.degree ?? "",
    branch: r.branch ?? "",
    gradYear: r.grad_year ?? 0,
    currentStatus: r.current_status ?? "",
    cgpa: r.cgpa ?? undefined,
    skills: r.skills ?? [],
    preferredRoles: r.preferred_roles ?? [],
    experienceLevel: r.experience_level ?? "",
    types: r.types ?? [],
    locations: r.locations ?? [],
    openToRemote: !!r.open_to_remote,
    availabilityDate: r.availability_date ?? undefined,
    githubUrl: r.github_url ?? undefined,
    linkedinUrl: r.linkedin_url ?? undefined,
  };
}
