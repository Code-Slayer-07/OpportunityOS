import { faviconUrl, hostnameOf, isValidSourceUrl, siteName } from "@/lib/discovery/sites";
import type { Opportunity } from "@/types";
import { formatDateTime } from "./format";

export const siteOf = (o: Pick<Opportunity, "sourceSite" | "sourceUrl">) => o.sourceSite || siteName(o.sourceUrl);

/** Where this listing really came from: site name + favicon, plain hostname, and when we fetched the page. */
export function SourceBadge({ opportunity: o }: { opportunity: Opportunity }) {
  const host = hostnameOf(o.sourceUrl);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={faviconUrl(o.sourceUrl)} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm" loading="lazy" />
        {siteOf(o)}
      </span>
      <span>{host}</span>
      <span aria-hidden>·</span>
      <span>Fetched {formatDateTime(o.fetchedAt)}</span>
    </p>
  );
}

/** Opens the real page: the direct apply link when the page exposes one, otherwise the page we read. */
export function ApplyButton({ opportunity: o, compact = false }: { opportunity: Opportunity; compact?: boolean }) {
  const href = o.applyUrl && isValidSourceUrl(o.applyUrl) ? o.applyUrl : o.sourceUrl;
  if (!isValidSourceUrl(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center rounded-lg bg-brand-600 font-medium text-white hover:bg-brand-700 ${compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"}`}
    >
      Apply / View on {siteOf(o)} ↗
    </a>
  );
}
