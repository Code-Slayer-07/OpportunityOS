// Deadline urgency chip. Owner: Dev D. Shared by Matches and the Action Plan board.
import { daysLeft, urgencyLevel } from "@/lib/scoring/priority";
import type { UrgencyLevel } from "@/types";

const TONE: Record<UrgencyLevel, string> = {
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-700",
  grey: "bg-gray-200 text-gray-600",
  none: "bg-gray-100 text-gray-500",
};

export function urgencyLabel(days: number | null): string {
  if (days === null) return "No deadline";
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function UrgencyBadge({ deadline }: { deadline: string | null }) {
  const days = daysLeft(deadline);
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[urgencyLevel(days)]}`}>{urgencyLabel(days)}</span>;
}
