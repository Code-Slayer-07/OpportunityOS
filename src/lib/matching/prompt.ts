// Gemini prompt builder. Owner: Dev C.
import type { Opportunity, Profile } from "@/types";

export const SYSTEM_PROMPT = `You are an eligibility matcher. Compare the student profile to the opportunity. Return ONLY valid JSON. Do not invent facts; use only text present in the opportunity. If unsure, say so in gaps.

Scoring (0-100): skills match 40%, role fit 25%, deadline feasibility 20%, location/remote fit 15%.
Eligibility is a gate, not a weight: do not add or subtract points for it. Instead, if the opportunity text does not clearly state who may apply, or the profile may not satisfy a stated requirement, set eligibilityUncertain to true and say why in gaps.

Output fields:
- score: integer 0-100.
- reason: 2-3 sentences explaining why this student does or does not fit.
- evidenceMap: one item per requirement you checked. "requirement" is the requirement, "profileField" is the profile field that satisfies (or fails) it, and "quote" must be copied VERBATIM from the opportunity text provided. Never paraphrase a quote.
- gaps: requirements the student does not clearly meet, or things you could not verify.
- eligibilityUncertain: boolean.`;

const MAX_TEXT = 4000;

export function buildUserPrompt(profile: Profile, opp: Opportunity, now = new Date()): string {
  const daysLeft =
    opp.deadline === null ? null : Math.ceil((new Date(opp.deadline).getTime() - now.getTime()) / 86_400_000);

  return JSON.stringify(
    {
      today: now.toISOString().slice(0, 10),
      studentProfile: {
        degree: profile.degree,
        branch: profile.branch,
        gradYear: profile.gradYear,
        currentStatus: profile.currentStatus,
        cgpa: profile.cgpa ?? null,
        skills: profile.skills,
        preferredRoles: profile.preferredRoles,
        experienceLevel: profile.experienceLevel,
        locations: profile.locations,
        openToRemote: profile.openToRemote,
      },
      opportunity: {
        type: opp.type,
        title: opp.title,
        org: opp.org,
        eligibilityText: opp.eligibilityText.slice(0, MAX_TEXT),
        evidenceSnippets: opp.evidenceSnippets,
        deadline: opp.deadline,
        daysUntilDeadline: daysLeft,
        location: opp.location,
        remote: opp.remote,
        reward: opp.reward,
      },
    },
    null,
    2,
  );
}

export const BATCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You will receive ONE student profile and an array of opportunities, each with a numeric "id". Return {"results": [...]} with exactly one result per opportunity, each carrying the same "id" and the fields described above. Judge every opportunity independently.`;

export function buildBatchPrompt(profile: Profile, opps: Opportunity[], now = new Date()): string {
  const items = opps.map((o, id) => ({ id, ...(JSON.parse(buildUserPrompt(profile, o, now)).opportunity as object) }));
  const base = JSON.parse(buildUserPrompt(profile, opps[0], now));
  return JSON.stringify({ today: base.today, studentProfile: base.studentProfile, opportunities: items }, null, 2);
}
