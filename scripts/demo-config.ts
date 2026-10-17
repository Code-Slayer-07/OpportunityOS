// Shared by the demo scripts: the demo account and its profile. Owner: Dev B.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_EMAIL, findUserIdByEmail } from "../src/lib/matching/prescore";
import { rowToProfile } from "../src/lib/profile";
import type { Profile } from "../src/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Env may already be set by the shell.
}

export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "demo-password-123";

export const DEMO_PROFILE_ROW = {
  name: "Aarav S",
  degree: "B.Tech",
  branch: "CSE",
  grad_year: 2027,
  current_status: "3rd year",
  cgpa: 8.2,
  skills: ["React", "Python", "Node.js", "ML"],
  preferred_roles: ["SDE intern"],
  experience_level: "projects",
  types: ["internship", "hackathon", "scholarship"],
  locations: ["Delhi"],
  open_to_remote: true,
  profile_complete: true,
};

/** Create the demo user and profile if needed. Returns the user id and profile. */
export async function ensureDemoUser(admin: SupabaseClient): Promise<{ userId: string; profile: Profile; email: string }> {
  const email = DEMO_EMAIL();
  let userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name: DEMO_PROFILE_ROW.name } });
    if (error || !data.user) throw new Error(`Could not create demo user: ${error?.message}`);
    userId = data.user.id;
  }
  const { error } = await admin.from("profiles").upsert({ id: userId, email, ...DEMO_PROFILE_ROW });
  if (error) throw new Error(`Could not save demo profile: ${error.message}`);
  const { data: row } = await admin.from("profiles").select("*").eq("id", userId).single();
  return { userId, profile: rowToProfile(row!), email };
}
