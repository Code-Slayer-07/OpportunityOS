import { describe, expect, it } from "vitest";
import type { Opportunity, Profile } from "@/types";
import { hedged, matchBatch, matchOpportunity } from "./gemini";

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

describe("hedged", () => {
  it("starts a second attempt when the first is slow and uses whichever succeeds first", async () => {
    let calls = 0;
    const v = await hedged(() => (++calls === 1 ? new Promise<string>((r) => setTimeout(() => r("slow"), 300)) : Promise.resolve("fast")), 20);
    expect(v).toBe("fast");
    expect(calls).toBe(2);
  });
  it("retries immediately when the first attempt fails, and rejects only if both fail", async () => {
    let calls = 0;
    await expect(hedged(async () => { calls++; throw new Error("boom"); }, 1000)).rejects.toThrow("boom");
    expect(calls).toBe(2);
    let n = 0;
    await expect(hedged(async () => { if (++n === 1) throw new Error("first"); return "ok"; }, 1000)).resolves.toBe("ok");
  });
});

describe("matchBatch", () => {
  const opps = [0, 1, 2].map((i) => ({ ...opp, title: `Role ${i}`, sourceUrl: `https://example.org/${i}` })) as Opportunity[];
  const item = (id: number) => ({ id, score: 70 + id, reason: "ok.", eligibilityUncertain: false, gaps: [], evidenceMap: [{ requirement: "r", profileField: "skills", quote: "Knowledge of React required." }] });

  it("scores several opportunities from one call, one result each", async () => {
    let calls = 0;
    const r = await matchBatch(profile, opps, async () => { calls++; return JSON.stringify({ results: [item(0), item(1), item(2)] }); });
    expect(calls).toBe(1);
    expect(r.map((x) => x.score)).toEqual([70, 71, 72]);
    expect(r.every((x) => x.source === "ai")).toBe(true);
  });

  it("falls back per item when the batch is missing one, without failing the others", async () => {
    const singles: string[] = [];
    const r = await matchBatch(profile, opps, async () => JSON.stringify({ results: [item(0), item(2)] }), async (_s, u) => { singles.push(u); return JSON.stringify({ score: 55, reason: "single.", eligibilityUncertain: true, gaps: ["g"], evidenceMap: [] }); });
    expect(r.map((x) => x.score)).toEqual([70, 55, 72]);
    expect(singles).toHaveLength(1);
  });

  it("uses rule-based results (source rules) when the whole call fails, never throws", async () => {
    const r = await matchBatch(profile, opps, async () => { throw new Error("503"); });
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.source === "rules")).toBe(true);
  });
});
