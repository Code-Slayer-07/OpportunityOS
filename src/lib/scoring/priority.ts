// Priority = fit score x urgency multiplier. Owner: Dev C. Pure functions, see priority.test.ts.
import type { UrgencyLevel } from "@/types";

const DAY_MS = 86_400_000;

// Whole days from today (UTC) to the deadline date. 0 = closes today (still open), negative = passed, null = no deadline.
export function daysLeft(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(deadline).getTime() - startOfToday) / DAY_MS);
}

export function urgencyLevel(days: number | null): UrgencyLevel {
  if (days === null) return "none";
  if (days < 0) return "grey";
  if (days < 3) return "red";
  if (days <= 7) return "amber";
  return "green";
}

export function urgencyMultiplier(days: number | null): number {
  if (days === null) return 1.0;
  if (days < 0) return 0.2;
  if (days <= 1) return 2.0;
  if (days < 3) return 1.7;
  if (days <= 7) return 1.3;
  if (days <= 14) return 1.1;
  return 1.0;
}

export const priority = (fitScore: number, days: number | null) => Math.round(fitScore * urgencyMultiplier(days) * 10) / 10;

// Highest priority first; passed deadlines always last.
export function sortByPriority<T extends { priority: number; daysLeft: number | null }>(items: T[]): T[] {
  const passed = (i: T) => i.daysLeft !== null && i.daysLeft < 0;
  return [...items].sort((a, b) => Number(passed(a)) - Number(passed(b)) || b.priority - a.priority);
}

// One-line "why is this on top", e.g. "Strong match (82) and closes in 2 days".
export function priorityReason(score: number, days: number | null): string {
  const strength = score >= 75 ? "Strong match" : score >= 50 ? "Good match" : "Possible match";
  if (days === null) return `${strength} (${score}), no deadline listed`;
  const when =
    days < 0 ? "has closed" : days === 0 ? "closes today" : days === 1 ? "closes tomorrow" : `closes in ${days} days`;
  return `${strength} (${score}) and ${when}`;
}
