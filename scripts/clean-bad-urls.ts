// Remove stored opportunities whose source URL is fake or unusable (example.com, localhost, *.test, empty, non-http(s)).
// Prints every row first, then deletes. Matches and applications for those rows are removed by ON DELETE CASCADE.
//
//   npm run clean-urls            list, then delete
//   npm run clean-urls -- --dry   list only
import { createAdminClient } from "../src/lib/supabase/admin";
import { isValidSourceUrl } from "../src/lib/discovery/sites";
import { classifyUrl } from "../src/lib/discovery/urlClassifier";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Env may already be set by the shell.
}

async function main() {
  const dry = process.argv.includes("--dry");
  const admin = createAdminClient();
  const { data, error } = await admin.from("opportunities").select("id, type, title, org, source_url");
  if (error) throw new Error(error.message);

  // Fake/invalid URLs, plus pages that can never be a listing (API hosts, documents, articles).
  const bad = (data ?? []).filter((r) => !isValidSourceUrl(r.source_url) || classifyUrl(r.source_url) === "skip");
  console.log(`${data?.length ?? 0} rows checked, ${bad.length} with a fake, invalid or non-listing source URL:\n`);
  for (const r of bad) console.log(`  ${r.type.padEnd(11)} ${String(r.title).slice(0, 44).padEnd(44)} ${String(r.org).slice(0, 24).padEnd(24)} ${r.source_url}`);

  if (bad.length === 0 || dry) return console.log(dry ? "\nDry run: nothing deleted." : "\nNothing to delete.");

  const { error: delError } = await admin.from("opportunities").delete().in("id", bad.map((r) => r.id));
  if (delError) throw new Error(delError.message);
  console.log(`\nDeleted ${bad.length} rows.`);
}

main().catch((e) => {
  console.error("clean-bad-urls failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
