import type { Evidence } from "@/types";
import { formatDate } from "./format";

export function EvidenceList({ items }: { items: Evidence[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No quoted evidence is available for this match.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((e, i) => (
        <li key={i} className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm">
            <span className="font-medium text-gray-900">{e.requirement}</span>
            <span className="text-gray-500"> · matches your </span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">{e.profileField}</span>
          </p>
          <blockquote className="mt-2 border-l-4 border-indigo-300 bg-indigo-50/50 py-1 pl-3 text-sm italic text-gray-800">
            “{e.quote}”
          </blockquote>
          <p className="mt-2 text-xs text-gray-500">
            Source:{" "}
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              {hostname(e.sourceUrl)}
            </a>{" "}
            · fetched {formatDate(e.fetchedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
