import { describe, expect, it } from "vitest";
import type { Opportunity, Profile } from "@/types";
import { matchOpportunity } from "./gemini";

const profile: Profile = {
  degree: "B.Tech", branch: "CSE", gradYear: 2027, currentStatus: "3rd year", skills: ["React", "Python"],
  preferredRoles: ["SDE intern"], experienceLevel: "projects", types: ["internship"], locations: ["Delhi"], openToRemote: true,
};
const opp: Opportunity = {
  type: "internship", title: "SDE Intern", org: "Acme", eligibilityText: "B.Tech CSE students. Knowledge of React required.",
  deadline: null, location: "Delhi", remote: false, reward: null, sourceUrl: "https://example.com/job",
  fetchedAt: "2026-10-17T00:00:00.000Z", evidenceSnippets: ["Knowledge of React required."],
};
const good = {
  score: 82, reason: "Strong fit.", eligibilityUncertain: false, gaps: [],
  evidenceMap: [
    { requirement: "React", profileField: "skills", quote: "Knowledge of React required." },
    { requirement: "Invented", profileField: "skills", quote: "Must have 10 years of Rust" },
  ],
};

describe("matchOpportunity", () => {
  it("keeps verbatim quotes, drops invented ones, stamps source fields, fills gaps", async () => {
    const r = await matchOpportunity(profile, opp, async () => JSON.stringify(good));
    expect(r.source).toBe("ai");
    expect(r.evidenceMap).toHaveLength(1);
    expect(r.evidenceMap[0]).toMatchObject({ sourceUrl: opp.sourceUrl, fetchedAt: opp.fetchedAt });
    expect(r.gaps.length).toBeGreaterThan(0);
  });

  it("uses opportunity snippets when the model gives no usable evidence", async () => {
    const r = await matchOpportunity(profile, opp, async () => JSON.stringify({ ...good, evidenceMap: [] }));
    expect(r.evidenceMap[0].quote).toBe("Knowledge of React required.");
  });

  it("retries once, then succeeds", async () => {
    let calls = 0;
    const r = await matchOpportunity(profile, opp, async () => (++calls === 1 ? "not json" : JSON.stringify(good)));
    expect(calls).toBe(2);
    expect(r.source).toBe("ai");
  });

  it("falls back to the rule-based score on bad output, without throwing", async () => {
    let calls = 0;
    const r = await matchOpportunity(profile, opp, async () => { calls++; return '{"score":"high"}'; });
    expect(calls).toBe(2);
    expect(r.source).toBe("rules");
    expect(r.reason).toBe("AI reasoning unavailable, showing rule-based score");
    expect(r.gaps).toEqual(["Reasoning unavailable"]);
    expect(r.evidenceMap).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("falls back when the call itself throws", async () => {
    const r = await matchOpportunity(profile, opp, async () => { throw new Error("timeout"); });
    expect(r.source).toBe("rules");
  });
});
