// Background "find opportunities" job: discover, save and score each row as it is extracted, then catch up. Owner: Dev B.
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchOpportunity } from "@/lib/matching/gemini";
import { demoMode, runMatching } from "@/lib/matching/run";
import { passesGate } from "@/lib/matching/ruleGate";
import type { DiscoveryJob, Profile } from "@/types";
import { discover } from "./pipeline";
import { runDiscovery } from "./run";
import { listKnownKeys, listStale, upsertOpportunities } from "./store";

const STALE_JOB_MS = 10 * 60 * 1000; // a "running" job older than this was killed with its server

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const toJob = (r: Row): DiscoveryJob => ({
  id: r.id,
  status: r.status,
  stage: r.stage,
  total: r.total,
  done: r.done,
  found: r.found,
  scored: r.scored,
  warning: r.warning ?? null,
  error: r.error ?? null,
});

/** Create a job unless this user already has one running (returns the running one instead). */
export async function createJob(admin: SupabaseClient, userId: string): Promise<{ job: DiscoveryJob; existing: boolean }> {
  const insert = () => admin.from("discovery_jobs").insert({ user_id: userId }).select("*").single();
  let { data, error } = await insert();
  if (!error) return { job: toJob(data), existing: false };

  if (error.code === "23505") {
    const { data: running } = await admin.from("discovery_jobs").select("*").eq("user_id", userId).eq("status", "running").maybeSingle();
    if (running) {
      // A "running" job that stopped updating was killed with its server: close it and start fresh.
      if (Date.now() - new Date(running.updated_at).getTime() > STALE_JOB_MS) {
        await admin.from("discovery_jobs").update({ status: "failed", error: "Timed out", finished_at: new Date().toISOString() }).eq("id", running.id);
        ({ data, error } = await insert());
        if (!error) return { job: toJob(data), existing: false };
      } else {
        return { job: toJob(running), existing: true };
      }
    }
  }
  throw new Error(error?.message ?? "Could not create job");
}

export async function getJob(supabase: SupabaseClient, userId: string, id?: string): Promise<DiscoveryJob | null> {
  let q = supabase.from("discovery_jobs").select("*").eq("user_id", userId);
  q = id ? q.eq("id", id) : q.order("created_at", { ascending: false }).limit(1);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toJob(data) : null;
}

const patch = async (admin: SupabaseClient, id: string, fields: Row): Promise<void> => {
  await admin.from("discovery_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
};

/** Runs to completion in the background. Never throws: every outcome is written to the job row. */
export async function runJob(admin: SupabaseClient, jobId: string, userId: string, profile: Profile): Promise<void> {
  const finish = (status: "done" | "partial" | "failed", fields: Row = {}) =>
    patch(admin, jobId, { status, stage: "done", finished_at: new Date().toISOString(), ...fields });

  try {
    // DEMO_MODE: no web, no Gemini. Serve what is saved; matching returns stored AI matches plus instant labelled cards.
    if (demoMode()) {
      await discover(admin, profile);
      await patch(admin, jobId, { stage: "matching" });
      const { matches } = await runMatching(admin, userId, profile);
      return void (await finish("done", { scored: matches.length }));
    }

    let found = 0;
    let scored = 0;
    const stale = await listStale(admin).catch(() => []);
    const known = await listKnownKeys(admin).catch(() => new Set<string>());
    const result = await runDiscovery(profile, {
      seed: Math.floor(Date.now() / 3_600_000),
      stale,
      known,
      hooks: {
        onProgress: ({ stage, total, done }) => patch(admin, jobId, { stage, total, done }),
        // Save the row the moment it is extracted and score it, so the page can show it while the rest are still running.
        onRow: async (o) => {
          const [saved] = await upsertOpportunities(admin, [o]);
          if (!saved) return;
          found++;
          if (saved.flag !== "dead_link" && passesGate(profile, saved).pass) {
            const r = await matchOpportunity(profile, saved);
            if (r.source === "ai") {
              const { error } = await admin.from("matches").upsert(
                {
                  user_id: userId,
                  opportunity_id: saved.id,
                  score: r.score,
                  reason: r.reason,
                  evidence_map: r.evidenceMap,
                  gaps: r.gaps,
                  eligibility_uncertain: r.eligibilityUncertain,
                  is_fallback: false,
                  created_at: new Date().toISOString(),
                },
                { onConflict: "user_id,opportunity_id" },
              );
              if (!error) scored++;
            }
          }
          await patch(admin, jobId, { found, scored });
        },
      },
    });

    await patch(admin, jobId, { stage: "matching", found, scored });
    await runMatching(admin, userId, profile).catch((e) => console.warn("[job] catch-up matching failed:", e instanceof Error ? e.message : e));

    console.log(`[discover] job=${jobId} queries=${result.queries} urls=${result.urls} saved=${found} scored=${scored} skipped=${result.skipped.length} ms=${result.ms}`);
    if (result.warning && found === 0) return void (await finish("partial", { found, scored, warning: result.warning }));
    const partial = result.budgetExceeded || !!result.warning;
    await finish(partial ? "partial" : "done", {
      found,
      scored,
      warning: result.warning ?? (result.budgetExceeded ? "Stopped at the time limit; showing what was found." : null),
    });
  } catch (e) {
    await finish("failed", { error: e instanceof Error ? e.message.slice(0, 300) : "Discovery failed" });
  }
}
