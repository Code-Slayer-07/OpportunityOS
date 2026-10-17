import { describe, expect, it } from "vitest";
import type { Opportunity, Profile } from "@/types";
import { passesGate } from "./ruleGate";

const NOW = new Date("2026-10-17T12:00:00Z");

const profile: Profile = {
  degree: "B.Tech",
  branch: "CSE",
  gradYear: 2027,
  currentStatus: "3rd year",
  skills: ["React", "Python"],
  preferredRoles: ["SDE intern"],
  experienceLevel: "projects",
  types: ["internship", "hackathon"],
  locations: ["Delhi", "Bangalore"],
  openToRemote: true,
};

const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
  type: "internship",
  title: "SDE Intern",
  org: "Acme",
  eligibilityText: "",
  deadline: "2026-12-01T00:00:00.000Z",
  location: "Delhi",
  remote: false,
  reward: null,
  sourceUrl: "https://example.com",
  fetchedAt: NOW.toISOString(),
  evidenceSnippets: [],
  ...over,
});

describe("passesGate", () => {
  it("passes a matching listing", () => {
    expect(passesGate(profile, opp({ eligibilityText: "B.Tech CSE, 2027 batch" }), NOW)).toEqual({ pass: true, reasons: [] });
  });

  it("passes when the listing is unclear (conservative)", () => {
    expect(passesGate(profile, opp({ eligibilityText: "Open to motivated students", location: "", deadline: null }), NOW).pass).toBe(true);
    expect(passesGate(profile, opp({ eligibilityText: "Any degree, any branch welcome" }), NOW).pass).toBe(true);
  });

  it("fails an unwanted type", () => {
    const r = passesGate(profile, opp({ type: "scholarship" }), NOW);
    expect(r.pass).toBe(false);
    expect(r.reasons[0]).toMatch(/type/i);
  });

  it("fails a passed deadline but allows today's", () => {
    expect(passesGate(profile, opp({ deadline: "2026-10-01T00:00:00.000Z" }), NOW).pass).toBe(false);
    expect(passesGate(profile, opp({ deadline: "2026-10-17T00:00:00.000Z" }), NOW).pass).toBe(true);
  });

  it("handles location and remote", () => {
    expect(passesGate(profile, opp({ location: "Mumbai" }), NOW).pass).toBe(false);
    expect(passesGate(profile, opp({ location: "Mumbai", remote: true }), NOW).pass).toBe(true);
    expect(passesGate({ ...profile, openToRemote: false }, opp({ location: "Mumbai", remote: true }), NOW).pass).toBe(false);
    expect(passesGate(profile, opp({ type: "hackathon", location: "Mumbai" }), NOW).pass).toBe(true);
  });

  it("fails a clearly different degree, passes a listed one", () => {
    expect(passesGate(profile, opp({ eligibilityText: "Open to BCA and MCA students only" }), NOW).pass).toBe(false);
    expect(passesGate(profile, opp({ eligibilityText: "B.Tech / M.Tech students" }), NOW).pass).toBe(true);
  });

  it("fails a clearly different branch, passes computing branches", () => {
    expect(passesGate(profile, opp({ eligibilityText: "B.Tech Mechanical or Civil" }), NOW).pass).toBe(false);
    expect(passesGate(profile, opp({ eligibilityText: "B.Tech Information Technology" }), NOW).pass).toBe(true);
  });

  it("checks the graduation batch only when stated", () => {
    expect(passesGate(profile, opp({ eligibilityText: "2026 batch only" }), NOW).pass).toBe(false);
    expect(passesGate(profile, opp({ eligibilityText: "Graduating in 2026 or 2027" }), NOW).pass).toBe(true);
    expect(passesGate(profile, opp({ evidenceSnippets: ["Open to the 2026 pass-out batch"] }), NOW).pass).toBe(false);
  });

  it("final-year listings exclude early-year students only", () => {
    const text = "Open to final year students";
    expect(passesGate(profile, opp({ eligibilityText: text }), NOW).pass).toBe(true);
    expect(passesGate({ ...profile, currentStatus: "1st year", gradYear: 2030 }, opp({ eligibilityText: text }), NOW).pass).toBe(false);
  });
});
