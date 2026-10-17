import { describe, expect, it } from "vitest";
import { passesGate } from "@/lib/matching/ruleGate";
import { rowToProfile } from "@/lib/profile";
import { dedupeKey } from "./dedupe";
import { isExpired } from "./normalize";
import { seedOpportunities } from "./seed";

const NOW = new Date("2026-10-17T10:00:00Z");
const demoProfile = rowToProfile({
  degree: "B.Tech", branch: "CSE", grad_year: 2027, current_status: "3rd year", skills: ["React", "Python"],
  preferred_roles: ["SDE intern"], types: ["internship", "hackathon", "scholarship"], locations: ["Delhi"], open_to_remote: true,
});

describe("seed data", () => {
  const seeds = seedOpportunities(NOW);

  it("covers all four types, has unique keys and no expired deadlines", () => {
    expect(new Set(seeds.map((s) => s.type))).toEqual(new Set(["internship", "job", "hackathon", "scholarship"]));
    expect(new Set(seeds.map(dedupeKey)).size).toBe(seeds.length);
    expect(seeds.some((s) => isExpired(s.deadline, NOW))).toBe(false);
  });

  it("gives the demo profile at least 10 gate-passing opportunities", () => {
    expect(seeds.filter((s) => passesGate(demoProfile, s, NOW).pass).length).toBeGreaterThanOrEqual(10);
  });

  it("keeps quoted evidence verbatim in the eligibility text", () => {
    for (const s of seeds) for (const q of s.evidenceSnippets) expect(s.eligibilityText).toContain(q);
  });
});
