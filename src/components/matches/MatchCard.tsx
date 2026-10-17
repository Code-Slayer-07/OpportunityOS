"use client";

import { useState } from "react";
import { UrgencyBadge } from "@/components/action-plan/UrgencyBadge";
import { FlagTag } from "@/components/ui/FlagTag";
import { useApplications, useSaveApplication } from "@/hooks";
import type { MatchWithOpportunity } from "@/types";
import { EvidenceList } from "./EvidenceList";
import { formatDate } from "./format";

const scoreTone = (score: number) =>
  score >= 75 ? "bg-green-100 text-green-800 ring-green-300" : score >= 50 ? "bg-amber-100 text-amber-800 ring-amber-300" : "bg-gray-100 text-gray-600 ring-gray-300";

// Fallback results (Gemini unavailable) carry this marker text from the matcher.
const isFallback = (m: MatchWithOpportunity) =>
  m.reason.startsWith("AI reasoning unavailable") || m.gaps.includes("Reasoning unavailable");

export function MatchCard({ match }: { match: MatchWithOpportunity }) {
  const [open, setOpen] = useState(false);
  const save = useSaveApplication();
  const { data: applications } = useApplications();
  // Optimistic: the cache already contains the item while the POST is in flight.
  const saved = !!applications?.some((a) => a.opportunityId === match.opportunityId);
  const { opportunity: o } = match;
  const fallback = isFallback(match);
  const where = [o.location, o.remote && "Remote"].filter(Boolean).join(" · ") || "Location not listed";

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex gap-4 p-4 sm:p-5">
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full ring-2 ${scoreTone(match.score)}`}
          aria-label={`Match score ${match.score} out of 100`}
        >
          <span className="text-lg font-bold leading-none">{match.score}</span>
          <span className="text-[10px] uppercase tracking-wide">match</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{o.title}</h3>
              <p className="text-sm text-gray-600">{o.org}</p>
            </div>
            <button
              type="button"
              disabled={saved}
              onClick={() => save.mutate(match)}
              title={save.isError ? "Couldn't save. Click to retry." : saved ? "In your Action Plan" : "Add to your Action Plan"}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                saved
                  ? "border-green-300 bg-green-50 text-green-700"
                  : save.isError
                    ? "border-red-300 text-red-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {saved ? "✓ Saved" : save.isError ? "Retry save" : "Save"}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-600">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium capitalize text-indigo-700">{o.type}</span>
            <FlagTag flag={o.flag} />
            <span>{where}</span>
            {o.reward && <span className="max-w-xs truncate" title={o.reward}>💰 {o.reward}</span>}
            <span className="inline-flex items-center gap-1.5">
              {o.deadline ? `Deadline ${formatDate(o.deadline)}` : null}
              <UrgencyBadge deadline={o.deadline} />
            </span>
          </div>

          {/* Always visible so the card answers "why am I seeing this?" without expanding. */}
          <p className={`mt-3 text-sm text-gray-800 ${open ? "" : "line-clamp-2"}`}>
            {fallback && <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">Rule-based</span>}
            {match.reason}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              {open ? "Hide details ▲" : "Why you qualify ▼"}
            </button>
            <span className="text-xs text-gray-400">as of {formatDate(o.fetchedAt)}</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          {match.eligibilityUncertain && (
            <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span aria-hidden>⚠️</span>
              <span>
                <strong>Eligibility unclear, verify on source.</strong>{" "}
                <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Open the listing
                </a>
              </span>
            </div>
          )}

          <section>
            <h4 className="mb-1 text-sm font-semibold text-gray-900">Why you qualify</h4>
            <p className="text-sm text-gray-700">{match.reason}</p>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Evidence</h4>
            {fallback && (
              <p className="mb-2 text-sm text-gray-500">Reasoning unavailable. This score is rule-based (skills, role, deadline, location).</p>
            )}
            <EvidenceList items={match.evidenceMap} />
          </section>

          <section>
            <h4 className="mb-1 text-sm font-semibold text-gray-900">Gaps</h4>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
              {match.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </section>

          <a
            href={o.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            View original listing ↗
          </a>
        </div>
      )}
    </article>
  );
}
