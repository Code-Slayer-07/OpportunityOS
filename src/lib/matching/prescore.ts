// Pre-score the demo user's real, cached opportunities with Gemini and store real AI matches. Owner: Dev C.
// Used by scripts/prescore-demo.ts and (opt-in) at server start. Never saves rule-based fallbacks.
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToProfile } from "@/lib/profile";
import { runMatching, type MatchRunResult } from "./run";

export const DEMO_EMAIL = () => process.env.DEMO_USER_EMAIL ?? "demo@opportunityos.dev";

export async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  return data.users.find((u) => u.email === email)?.id ?? null;
}

export async function prescoreUser(admin: SupabaseClient, userId: string, { force = false } = {}): Promise<MatchRunResult> {
  const { data: row, error } = await admin.from("profiles").select("*").eq("id", userId).single();
  if (error || !row) throw new Error(`No profile for ${userId}`);
  return runMatching(admin, userId, rowToProfile(row), { maxPerRun: 40, force, live: true });
}
