// GET/PUT current user's profile. Owner: Dev A.
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/requireUser";
import { profileSchema, REQUIRED_PROFILE_FIELDS, type ProfileInput } from "@/lib/validation/schemas";

type ProfileRow = Record<string, unknown>;

// DB row (snake_case) -> API shape (camelCase, matches the Profile type).
const toApi = (r: ProfileRow) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  degree: r.degree,
  branch: r.branch,
  gradYear: r.grad_year,
  currentStatus: r.current_status,
  cgpa: r.cgpa,
  skills: r.skills,
  preferredRoles: r.preferred_roles,
  experienceLevel: r.experience_level,
  types: r.types,
  locations: r.locations,
  openToRemote: r.open_to_remote,
  availabilityDate: r.availability_date,
  githubUrl: r.github_url,
  linkedinUrl: r.linkedin_url,
  profileComplete: r.profile_complete,
});

const isFilled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "");

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data) return fail("Profile not found", 404);
  return ok(toApi(data));
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  const p = parsed.data;

  const { data: existing, error: readError } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (readError) return fail(readError.message, 500);

  // Merge with what's stored so a partial save still computes completeness correctly.
  const merged: ProfileInput = {
    degree: p.degree ?? existing?.degree,
    branch: p.branch ?? existing?.branch,
    gradYear: p.gradYear ?? existing?.grad_year,
    currentStatus: p.currentStatus ?? existing?.current_status,
    skills: p.skills ?? existing?.skills,
    preferredRoles: p.preferredRoles ?? existing?.preferred_roles,
    experienceLevel: p.experienceLevel ?? existing?.experience_level,
    types: p.types ?? existing?.types,
    locations: p.locations ?? existing?.locations,
  };
  const complete = REQUIRED_PROFILE_FIELDS.every((f) => isFilled(merged[f]));

  const update = {
    id: auth.user.id,
    email: auth.user.email,
    name: p.name,
    degree: p.degree,
    branch: p.branch,
    grad_year: p.gradYear,
    current_status: p.currentStatus,
    cgpa: p.cgpa,
    skills: p.skills,
    preferred_roles: p.preferredRoles,
    experience_level: p.experienceLevel,
    types: p.types,
    locations: p.locations,
    open_to_remote: p.openToRemote,
    availability_date: p.availabilityDate,
    github_url: p.githubUrl === "" ? null : p.githubUrl,
    linkedin_url: p.linkedinUrl === "" ? null : p.linkedinUrl,
    profile_complete: complete,
  };
  // Drop undefined so omitted fields keep their stored value.
  const row: Record<string, any> = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined));

  const { data, error } = await auth.supabase.from("profiles").upsert(row).select("*").single();
  if (error) return fail(error.message, 500);
  return ok(toApi(data));
}
