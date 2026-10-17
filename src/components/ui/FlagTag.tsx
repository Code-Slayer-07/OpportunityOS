import type { OpportunityFlag } from "@/types";

// Muted tag for stale/partial records, so they are visibly lower-trust instead of looking broken.
export function FlagTag({ flag }: { flag?: OpportunityFlag | null }) {
  if (!flag) return null;
  const label = flag === "expired" ? "Expired" : "Details incomplete, verify on source";
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{label}</span>;
}
