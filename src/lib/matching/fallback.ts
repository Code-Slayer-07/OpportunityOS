// Rule-based score used when Gemini is unavailable. Owner: Dev C.
// Same weights as the prompt: skills 40, role 25, deadline 20, location 15.
import type { Match, Opportunity, Profile } from "@/types";

export type MatchResult = Omit<Match, "id" | "opportunityId">;

const GENERIC_ROLE_WORDS = new Set(["intern", "internship", "engineer", "developer", "the", "and"]);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${escape(word)}([^a-z0-9]|$)`, "i").test(text);

function skillScore(profile: Profile, text: string) {
  const matched = profile.skills.filter((s) => s.trim() && hasWord(text, s.trim())).length;
  return Math.min(1, matched / 3);
}

function roleScore(profile: Profile, title: string) {
  let best = 0;
  for (const role of profile.preferredRoles) {
    const words = role.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !GENERIC_ROLE_WORDS.has(w));
    if (hasWord(title, role)) return 1;
    if (words.some((w) => hasWord(title, w))) best = Math.max(best, 0.6);
    else if (/intern|engineer|developer|sde/i.test(title) && /intern|engineer|developer|sde/i.test(role)) best = Math.max(best, 0.3);
  }
  return best;
}

function deadlineScore(deadline: string | null, now: Date) {
  if (deadline === null) return 0.6;
  const days = (new Date(deadline).getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 0;
  return days < 3 ? 0.3 : days < 7 ? 0.6 : 1;
}

function locationScore(profile: Profile, opp: Opportunity) {
  if (opp.remote && profile.openToRemote) return 1;
  const loc = opp.location.toLowerCase();
  if (!loc) return 0.6;
  if (profile.locations.some((l) => loc.includes(l.trim().toLowerCase()))) return 1;
  return /india|online|virtual|anywhere|global/.test(loc) ? 0.7 : 0.2;
}

export function ruleBasedMatch(profile: Profile, opp: Opportunity, now = new Date()): MatchResult {
  const text = [opp.title, opp.eligibilityText, ...opp.evidenceSnippets].join(" ");
  const score = Math.round(
    100 *
      (0.4 * skillScore(profile, text) +
        0.25 * roleScore(profile, opp.title) +
        0.2 * deadlineScore(opp.deadline, now) +
        0.15 * locationScore(profile, opp)),
  );
  return {
    score,
    reason: "AI reasoning unavailable, showing rule-based score",
    evidenceMap: [],
    gaps: ["Reasoning unavailable"],
    eligibilityUncertain: true,
  };
}
