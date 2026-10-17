"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useFindOpportunities, useMatches, useProfile } from "@/hooks";
import type { DiscoveryJob, OpportunityType } from "@/types";
import { MatchCard } from "./MatchCard";
import { MatchSkeleton } from "./MatchSkeleton";
import { siteOf } from "./SourceBadge";

const FILTERS: { value: OpportunityType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "internship", label: "Internship" },
  { value: "job", label: "Job" },
  { value: "hackathon", label: "Hackathon" },
  { value: "scholarship", label: "Scholarship" },
];

function Progress({ job }: { job: DiscoveryJob | null }) {
  const stage = job?.stage ?? "searching";
  const steps = [
    { key: "searching", label: "Searching the web" },
    { key: "extracting", label: job && job.total > 0 ? `Reading listings ${job.done}/${job.total}` : "Reading listings" },
    { key: "matching", label: "Scoring matches" },
  ];
  const current = Math.max(0, steps.findIndex((x) => x.key === stage));
  return (
    <ol role="status" aria-live="polite" className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm">
      {steps.map((x, i) => (
        <li key={x.key} className={`flex items-center gap-2 ${i < current ? "text-green-700" : i === current ? "font-semibold text-brand-700" : "text-gray-400"}`}>
          {i < current ? "✓" : i === current ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /> : "○"}
          {x.label}
          {i === current && "…"}
        </li>
      ))}
      {job && job.found > 0 && <li className="text-xs text-brand-600">{job.found} saved, {job.scored} scored so far. Cards appear as they are ready.</li>}
    </ol>
  );
}

export function MatchesView() {
  const profile = useProfile();
  const find = useFindOpportunities();
  const matches = useMatches({ polling: find.running });
  const [filter, setFilter] = useState<OpportunityType | "all">("all");
  const [source, setSource] = useState<string>("all");

  const all = matches.data ?? [];
  // Source chips come from the sources actually present in the results.
  const sources = [...new Set(all.map((m) => siteOf(m.opportunity)))].sort();
  const activeSource = source !== "all" && sources.includes(source) ? source : "all";
  const shown = all.filter((m) => (filter === "all" || m.opportunity.type === filter) && (activeSource === "all" || siteOf(m.opportunity) === activeSource));
  const running = find.running;
  const profileIncomplete = profile.data && !profile.data.profileComplete;

  if (profileIncomplete) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Build your profile first</h1>
        <p className="mt-2 text-gray-600">We match opportunities to your degree, skills and preferences. It takes about 3 minutes.</p>
        <Link href="/profile" className="mt-5 inline-flex rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Complete profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your matches</h1>
          <p className="mt-1 text-sm text-gray-600">Ranked by fit, each with the evidence behind it.</p>
        </div>
        <Button onClick={() => find.start()} disabled={running || !profile.data}>
          {running ? "Working…" : all.length > 0 ? "↻ Refresh" : "Find opportunities"}
        </Button>
      </div>

      {running && <Progress job={find.job} />}
      {find.warning && !running && (
        <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{find.warning}</p>
      )}
      {(find.startError || find.failure) && !running && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{find.startError ?? find.failure}</span>
          <button onClick={() => find.start()} className="font-medium underline">Retry</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f.value ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sources.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by source">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Source</span>
          {["all", ...sources].map((name) => (
            <button
              key={name}
              onClick={() => setSource(name)}
              aria-pressed={activeSource === name}
              className={`rounded-full border px-3 py-1 text-xs ${activeSource === name ? "border-gray-800 bg-gray-800 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}`}
            >
              {name === "all" ? "All sources" : name}
            </button>
          ))}
        </div>
      )}

      {matches.isError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{matches.error.message}</p>
          <Button className="mt-3" onClick={() => matches.refetch()}>Retry</Button>
        </div>
      ) : matches.isLoading || (running && all.length === 0) ? (
        <MatchSkeleton />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          {all.length === 0 ? (
            <>
              <p className="font-medium">No matches yet</p>
              <p className="mt-1 text-sm text-gray-600">Click “Find opportunities” and we’ll search live listings and check which ones you qualify for.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No {filter} matches</p>
              <p className="mt-1 text-sm text-gray-600">Try another filter, or broaden the opportunity types in your <Link href="/profile" className="text-brand-600 underline">profile</Link>.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      {!running && all.length > 0 && shown.length > 0 && (
        <p className="text-center text-sm text-gray-500">
          Not seeing enough? Broaden the types or locations in your <Link href="/profile" className="text-brand-600 underline">profile</Link>.
        </p>
      )}
    </div>
  );
}
