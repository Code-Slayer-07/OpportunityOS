"use client";

import Link from "next/link";
import { isOpen, useApplications } from "@/hooks";
import { priorityReason } from "@/lib/scoring/priority";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STATUSES, type ApplicationItem } from "@/types";
import { ApplicationCard } from "./ApplicationCard";
import { UrgencyBadge } from "./UrgencyBadge";

// Open items due in under 3 days (today counts; passed deadlines do not).
export const dueSoon = (items: ApplicationItem[]) => items.filter((a) => isOpen(a) && a.urgency === "red");

function Reminder({ items }: { items: ApplicationItem[] }) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span aria-hidden>⏰</span>
      <p>
        <strong>{items.length === 1 ? "1 item is" : `${items.length} items are`} due in under 3 days:</strong>{" "}
        {items.map((a) => a.opportunity.title).join(", ")}. Apply or update the status so it stops showing here.
      </p>
    </div>
  );
}

function TopPriorities({ items }: { items: ApplicationItem[] }) {
  // Items arrive sorted by priority; passed deadlines are already last, so skip them here.
  const top = items.filter((a) => isOpen(a) && (a.daysLeft === null || a.daysLeft >= 0)).slice(0, 3);
  if (top.length === 0) return null;
  return (
    <section aria-labelledby="top-priorities">
      <h2 id="top-priorities" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Top priorities
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {top.map((a, i) => (
          <li key={a.id} className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {i + 1}. {a.opportunity.title}
              </p>
              <UrgencyBadge deadline={a.opportunity.deadline} />
            </div>
            <p className="text-xs text-gray-600">{a.opportunity.org}</p>
            <p className="mt-2 text-sm text-indigo-900">{priorityReason(a.match?.score ?? 0, a.daysLeft)}</p>
            <a href={a.opportunity.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-indigo-600 underline">
              Open listing ↗
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ActionPlanBoard() {
  const { data, isLoading, isError, error, refetch } = useApplications();

  if (isLoading) return <p className="text-gray-600">Loading your action plan…</p>;
  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error.message}</p>
        <Button className="mt-3" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const items = data ?? [];
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Your action plan is empty</h1>
        <p className="mt-2 text-gray-600">Save opportunities from your matches and we’ll track deadlines and tell you what to do first.</p>
        <Link href="/matches" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Go to matches
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Action plan</h1>
      <Reminder items={dueSoon(items)} />
      <TopPriorities items={items} />

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-4">
          {APPLICATION_STATUSES.map((status) => {
            const column = items.filter((a) => a.status === status);
            return (
              <section key={status} aria-label={status} className="w-64 shrink-0 rounded-2xl bg-gray-100 p-3">
                <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-gray-700">
                  {status}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">{column.length}</span>
                </h2>
                <div className="space-y-3">
                  {column.map((a) => (
                    <ApplicationCard key={a.id} item={a} />
                  ))}
                  {column.length === 0 && <p className="py-4 text-center text-xs text-gray-400">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
