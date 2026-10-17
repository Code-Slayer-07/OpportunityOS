// Build an ApplicationItem (with computed urgency + priority). Pure; used by the API and by optimistic UI updates.
import { daysLeft, priority, urgencyLevel } from "@/lib/scoring/priority";
import type { Application, ApplicationItem, Opportunity } from "@/types";

export function toApplicationItem(
  app: Application,
  opportunity: Opportunity,
  match: { score: number; reason: string } | null,
  now = new Date(),
): ApplicationItem {
  const days = daysLeft(opportunity.deadline, now);
  return {
    ...app,
    opportunity,
    match,
    urgency: urgencyLevel(days),
    daysLeft: days,
    priority: priority(match?.score ?? 0, days),
  };
}
