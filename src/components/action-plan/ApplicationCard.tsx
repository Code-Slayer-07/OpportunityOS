"use client";

import { FlagTag } from "@/components/ui/FlagTag";
import { formatDate } from "@/components/matches/format";
import { useRemoveApplication, useUpdateApplicationStatus } from "@/hooks";
import { APPLICATION_STATUSES, type ApplicationItem, type ApplicationStatus } from "@/types";
import { ApplyButton } from "@/components/matches/SourceBadge";
import { UrgencyBadge } from "./UrgencyBadge";

const scoreTone = (s: number) => (s >= 75 ? "bg-green-100 text-green-800" : s >= 50 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600");

export function ApplicationCard({ item }: { item: ApplicationItem }) {
  const update = useUpdateApplicationStatus();
  const remove = useRemoveApplication();
  const o = item.opportunity;
  const pending = item.id.startsWith("temp-"); // optimistic row, server id not known yet

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-gray-900">{o.title}</h3>
          <p className="truncate text-xs text-gray-600">{o.org}</p>
        </div>
        {item.match && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${scoreTone(item.match.score)}`} title="Match score">
            {item.match.score}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <UrgencyBadge deadline={o.deadline} />
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs capitalize text-brand-700">{o.type}</span>
        <FlagTag flag={o.flag} />
      </div>

      <p className="mt-2 text-xs text-gray-400">as of {formatDate(o.fetchedAt)}</p>

      <div className="mt-2 flex items-center gap-2">
        <select
          aria-label={`Move ${o.title} to another column`}
          value={item.status}
          disabled={pending}
          onChange={(e) => update.mutate({ id: item.id, status: e.target.value as ApplicationStatus })}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Remove ${o.title}`}
          title="Remove from shortlist"
          disabled={pending}
          onClick={() => remove.mutate(item.id)}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          ✕
        </button>
      </div>
      <div className="mt-2">
        <ApplyButton opportunity={o} compact />
      </div>
      {(update.isError || remove.isError) && <p role="alert" className="mt-2 text-xs text-red-600">Couldn’t save that change. Try again.</p>}
    </article>
  );
}
