// Run Gemini for the demo user over the real cached opportunities and store real AI matches. Owner: Dev C.
//
//   npm run prescore               score anything that has no fresh AI match
//   npm run prescore -- --force    re-score everything
//   npm run prescore -- --report   also print the readiness report
//
// Rule-based fallbacks are never stored, so after this the demo user only has real AI matches.
import { createAdminClient } from "../src/lib/supabase/admin";
import { listOpportunities } from "../src/lib/discovery/store";
import { prescoreUser } from "../src/lib/matching/prescore";
import { listUserMatches } from "../src/lib/matching/store";
import { ensureDemoUser } from "./demo-config";

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

async function main() {
  const force = process.argv.includes("--force");
  const report = process.argv.includes("--report");
  const admin = createAdminClient();
  const { userId, profile, email } = await ensureDemoUser(admin);

  const t0 = Date.now();
  const { matches, stats } = await prescoreUser(admin, userId, { force });
  console.log(`Demo user ${email}: scored ${stats.matchedNow} with Gemini in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${stats.fallbacks} could not be scored\n`);
  console.log(`${"SCORE".padEnd(5)} ${pad("TITLE", 46)} ${pad("SITE", 12)} EVIDENCE`);
  for (const m of matches) console.log(`${String(m.score).padEnd(5)} ${pad(m.opportunity.title, 46)} ${pad(m.opportunity.sourceSite ?? "", 12)} ${m.evidenceMap.length}${m.isFallback ? "  (fallback, not saved)" : ""}`);

  if (!report) return;
  const opps = await listOpportunities(admin);
  const stored = await listUserMatches(admin, userId, profile);
  const aiSaved = stored.filter((m) => !m.isFallback);
  const sites = new Map<string, number>();
  for (const o of opps) sites.set(o.sourceSite ?? "?", (sites.get(o.sourceSite ?? "?") ?? 0) + 1);
  const ready = aiSaved.length >= 10 && stats.fallbacks === 0 && stored.every((m) => !m.isFallback);
  console.log("\n--- Demo readiness ---");
  console.log(`Opportunities (real, shown):  ${opps.length}`);
  console.log(`By site:                      ${[...sites].map(([s, n]) => `${s} ${n}`).join(", ") || "none"}`);
  console.log(`Types:                        ${[...new Set(opps.map((o) => o.type))].join(", ") || "none"}`);
  console.log(`Saved AI matches (demo user): ${aiSaved.length}`);
  console.log(`Fallback matches left:        ${stored.length - aiSaved.length} saved, ${stats.fallbacks} unsaved`);
  console.log(`Verdict: ${ready ? "READY" : "NOT READY (need >= 10 saved AI matches and no fallbacks)"}`);
}

main().catch((e) => {
  console.error("prescore-demo failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
