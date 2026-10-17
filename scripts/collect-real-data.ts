// Collect REAL opportunities for the demo profile by running live discovery repeatedly with different site rotations.
// Every row comes from a page our pipeline fetched; nothing is typed by hand. Dead links (HEAD/GET 404/410) are dropped.
//
//   npm run collect                  up to 5 runs, stops at >= 20 valid rows over >= 3 sites and >= 3 types
//   npm run collect -- --runs 3      limit the number of runs
//   npm run collect -- --dry         do not write to the database (in-memory only)
//
// Saves rows as they are extracted. If migration 0004 has not been applied yet it falls back to --dry and says so.
import { writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { dedupeOpportunities } from "../src/lib/discovery/dedupe";
import { isExpired } from "../src/lib/discovery/normalize";
import { runDiscovery, type SiteStat, type SkippedUrl } from "../src/lib/discovery/run";
import { canonicalUrl } from "../src/lib/discovery/dedupe";
import { listKnownKeys, listOpportunities, listStale, upsertOpportunities } from "../src/lib/discovery/store";
import type { Opportunity } from "../src/types";
import { ensureDemoUser } from "./demo-config";

const MAX_RUNS_DEFAULT = 5;
const GOAL = { rows: 20, sites: 3, types: 3 };

const argv = process.argv.slice(2);
const runsArg = argv.indexOf("--runs");
const MAX_RUNS = runsArg >= 0 ? Math.max(1, Number(argv[runsArg + 1]) || MAX_RUNS_DEFAULT) : MAX_RUNS_DEFAULT;
let dry = argv.includes("--dry");

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
const usable = (o: Opportunity) => o.flag !== "dead_link" && o.flag !== "expired" && !isExpired(o.deadline);

function goalMet(rows: Opportunity[]) {
  const ok = rows.filter(usable);
  return ok.length >= GOAL.rows && new Set(ok.map((o) => o.sourceSite)).size >= GOAL.sites && new Set(ok.map((o) => o.type)).size >= GOAL.types;
}

async function main() {
  const admin = createAdminClient();
  const { profile, email } = await ensureDemoUser(admin);

  if (!dry) {
    const probe = await admin.from("opportunities").select("source_key, source_site, origin").limit(1);
    if (probe.error) {
      console.warn(`Migration 0004 is not applied yet (${probe.error.message}). Running as --dry: nothing will be saved.\n`);
      dry = true;
    }
  }
  console.log(`Demo profile: ${email}, types ${profile.types.join("/")}${dry ? "  [dry run]" : ""}\n`);

  const collected: Opportunity[] = [];
  const skipped: SkippedUrl[] = [];
  const bySite: Record<string, SiteStat> = {};
  const runTimes: number[] = [];
  // The goal and the final table cover everything saved so far (earlier runs included), not only this session.
  const everything = async () => (dry ? dedupeOpportunities(collected) : dedupeOpportunities([...(await listOpportunities(admin)), ...collected]));
  const baseSeed = Math.floor(Date.now() / 3_600_000);
  const known = dry ? new Set<string>() : await listKnownKeys(admin).catch(() => new Set<string>());

  for (let i = 0; i < MAX_RUNS; i++) {
    const stale = dry ? [] : await listStale(admin).catch(() => []);
    const result = await runDiscovery(profile, {
      seed: baseSeed + i,
      stale,
      known,
      hooks: { onRow: dry ? undefined : async (o) => void (await upsertOpportunities(admin, [o])) },
    });
    runTimes.push(result.ms);
    skipped.push(...result.skipped);
    collected.push(...result.opportunities);
    for (const o of result.opportunities) known.add(canonicalUrl(o.sourceUrl)); // later runs spend their slots on new pages
    for (const [site, s] of Object.entries(result.bySite)) {
      const t = (bySite[site] ??= { tried: 0, stored: 0, skipped: {} });
      t.tried += s.tried;
      t.stored += s.stored;
      for (const [k, n] of Object.entries(s.skipped)) t.skipped[k] = (t.skipped[k] ?? 0) + n;
    }
    const all = await everything();
    console.log(
      `run ${i + 1}/${MAX_RUNS}: ${(result.ms / 1000).toFixed(1)}s, fetched ${result.urls} pages, saved ${result.opportunities.length}, skipped ${result.skipped.length}` +
        `${result.warning ? `  WARNING: ${result.warning}` : ""}  -> ${all.filter(usable).length} usable rows, ${new Set(all.filter(usable).map((o) => o.sourceSite)).size} sites, ${new Set(all.filter(usable).map((o) => o.type)).size} types`,
    );
    if (goalMet(all)) break;
  }

  const rows = await everything();
  const shown = rows.filter((o) => o.flag !== "dead_link");
  const dead = rows.filter((o) => o.flag === "dead_link");

  console.log(`\n${shown.length} real rows (${shown.filter(usable).length} usable, ${shown.length - shown.filter(usable).length} expired/incomplete), ${dead.length} dead links dropped\n`);
  console.log([pad("TITLE", 40), pad("ORG", 22), pad("TYPE", 11), pad("SITE", 12), pad("DEADLINE", 10), "HTTP", "SOURCE URL"].join(" "));
  for (const o of shown) {
    console.log([pad(o.title, 40), pad(o.org, 22), pad(o.type, 11), pad(o.sourceSite ?? "", 12), pad(o.deadline?.slice(0, 10) ?? "none", 10), String(o.httpStatus ?? "-").padEnd(4), o.sourceUrl].join(" "));
  }

  console.log("\nPer site (tried / stored / skipped by reason):");
  for (const [site, s] of Object.entries(bySite).sort((a, b) => b[1].stored - a[1].stored)) {
    console.log(`  ${pad(site, 28)} tried ${String(s.tried).padStart(2)}  stored ${String(s.stored).padStart(2)}  skipped ${JSON.stringify(s.skipped)}`);
  }
  const blocked = skipped.filter((s) => s.reason.startsWith("blocked"));
  console.log(`\nBlocked (login wall, captcha, empty): ${blocked.length ? blocked.map((b) => `${b.site}: ${b.reason.replace("blocked: ", "")}`).join("; ") : "none"}`);
  console.log(`Run times: ${runTimes.map((t) => `${(t / 1000).toFixed(1)}s`).join(", ")}`);
  console.log(`Goal (>= ${GOAL.rows} usable rows, >= ${GOAL.sites} sites, >= ${GOAL.types} types): ${goalMet(rows) ? "MET" : "not met"}`);

  writeFileSync("scripts/.last-discovery.json", JSON.stringify({ at: new Date().toISOString(), dry, rows, skipped, bySite, runTimes }, null, 2));
}

main().catch((e) => {
  console.error("collect-real-data failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
