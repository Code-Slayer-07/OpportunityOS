// Pre-cache the demo: create/refresh the demo user + profile, discover, match, print a summary. Owner: Dev B.
//
//   npm run prefetch               use cached/seeded opportunities, score what is missing
//   npm run prefetch -- --refresh  live TinyFish discovery + re-score everything with Gemini
//   npm run prefetch -- --reseed   replace the synthetic seed set (refreshes its deadlines)
//
// Needs .env.local (Supabase URL + service-role key, TINYFISH_API_KEY and GEMINI_API_KEY for --refresh).
import { createAdminClient } from "../src/lib/supabase/admin";
import { discover } from "../src/lib/discovery/pipeline";
import { ensureSeeded } from "../src/lib/discovery/seed";
import { listOpportunities } from "../src/lib/discovery/store";
import { runMatching } from "../src/lib/matching/run";
import { rowToProfile } from "../src/lib/profile";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Env may already be set by the shell.
}

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@opportunityos.dev";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "demo-password-123";

const DEMO_PROFILE = {
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

const args = new Set(process.argv.slice(2));
const refresh = args.has("--refresh");
const reseed = args.has("--reseed");

async function findOrCreateDemoUser(admin: ReturnType<typeof createAdminClient>) {
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const existing = list.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) return existing.id;

  const { data, error: createError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: DEMO_PROFILE.name },
  });
  if (createError || !data.user) throw new Error(`Could not create demo user: ${createError?.message}`);
  return data.user.id;
}

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

async function main() {
  const admin = createAdminClient();
  const userId = await findOrCreateDemoUser(admin);
  console.log(`Demo user: ${DEMO_EMAIL} (${userId})`);

  const { error } = await admin.from("profiles").upsert({ id: userId, email: DEMO_EMAIL, ...DEMO_PROFILE });
  if (error) throw new Error(`Could not save demo profile: ${error.message}`);
  const { data: row } = await admin.from("profiles").select("*").eq("id", userId).single();
  const profile = rowToProfile(row!);

  if (reseed) console.log(`Reseeded ${await ensureSeeded(admin, { reseed: true })} synthetic opportunities`);

  if (refresh) {
    console.log("Live discovery via TinyFish (can take a few minutes)…");
    const { opportunities, skipped } = await discover(admin, profile, { live: true });
    console.log(`Stored ${opportunities.length} live opportunities, skipped ${skipped.length}`);
  } else {
    const have = (await listOpportunities(admin)).length;
    if (have < 10) console.log(`Only ${have} cached opportunities; adding the seed set (${await ensureSeeded(admin)} added)`);
  }

  const { matches, stats } = await runMatching(admin, userId, profile, { maxPerRun: 30, force: refresh });
  console.log(`Matched ${stats.matchedNow} now (${stats.fallbacks} rule-based fallbacks), ${matches.length} total\n`);

  console.log([pad("TYPE", 12), pad("TITLE", 40), pad("ORG", 24), pad("DEADLINE", 11), "SCORE"].join(" "));
  for (const m of matches) {
    const o = m.opportunity;
    console.log([pad(o.type, 12), pad(o.title, 40), pad(o.org, 24), pad(o.deadline?.slice(0, 10) ?? "none", 11), m.score].join(" "));
  }
  if (matches.length < 10) console.warn(`\nWARNING: only ${matches.length} matches; the demo wants at least 10.`);
}

main().catch((e) => {
  console.error("Prefetch failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
