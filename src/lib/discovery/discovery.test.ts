import { describe, expect, it } from "vitest";
import { canonicalUrl, dedupeOpportunities } from "./dedupe";
import { detectBlocked, validateAgainstText } from "./extract";
import { parseDeadline, normalizeOpportunity } from "./normalize";
import { buildQueries } from "./queries";
import { planPages, runDiscovery, type DiscoveryDeps } from "./run";
import { isValidSourceUrl } from "./sites";
import { classify } from "./urlClassifier";
import type { Opportunity } from "@/types";

describe("URL validation", () => {
  it("rejects fake, local, empty and non-http(s) URLs", () => {
    for (const bad of ["", "not a url", "ftp://x.com/a", "https://example.com/demo/x", "http://localhost:3000/a", "https://foo.test/a", "https://116.50.82.133/a.pdf", "https://sub.example.org/x"]) {
      expect(isValidSourceUrl(bad), bad).toBe(false);
    }
    expect(isValidSourceUrl("https://unstop.com/hackathons/abc-1766190")).toBe(true);
  });
});

describe("classify", () => {
  it("separates single listings from index pages", () => {
    expect(classify("https://internshala.com/internship/detail/work-from-home-sde-intern-at-acme1756893108")).toBe("detail");
    expect(classify("https://internshala.com/internships/react-internship/")).toBe("index");
    expect(classify("https://unstop.com/hackathons/codetitans-india-2026-wecodecoders-1766190")).toBe("detail");
    expect(classify("https://unstop.com/hackathons")).toBe("index");
    expect(classify("https://hackaura.devfolio.co/")).toBe("detail");
    expect(classify("https://devfolio.co/hackathons/open")).toBe("index");
    expect(classify("https://in.linkedin.com/jobs/view/software-engineer-intern-at-weekday-4453416357")).toBe("detail");
    expect(classify("https://wellfound.com/jobs/4408970-full-stack-engineer-intern")).toBe("detail");
    expect(classify("https://wellfound.com/location/india")).toBe("index");
    expect(classify("https://www.buddy4study.com/page/idfc-first-bank-engineering-scholarship")).toBe("detail");
    expect(classify("https://www.buddy4study.com/scholarships/engineering")).toBe("index");
  });

  it("never treats articles, documents, API hosts or homepages as listings", () => {
    expect(classify("https://www.buddy4study.com/article/top-scholarships-girls-engineering-12th")).toBe("index");
    expect(classify("https://unstop.com/blog/upcoming-hackathons")).toBe("index");
    expect(classify("https://www.reliancefoundation.org/files/faq.pdf")).toBe("index");
    expect(classify("https://api.unstop.com/hackathons/x-1665244")).toBe("index");
    expect(classify("https://someco.com/")).toBe("index");
    expect(classify("https://someco.com/careers/job/12345")).toBe("unknown");
    // paths we have no pattern for on a known site are tried, not rejected
    expect(classify("https://www.hackerearth.com/community/challenges/hackathon/scriptedbyher-20/")).toBe("detail");
    expect(classify("https://unstop.com/p/all-india-hackathon-axcentra-1703933")).toBe("detail");
    expect(classify("https://booking.hackerearth.com/")).toBe("unknown");
  });
});

describe("parseDeadline", () => {
  it("reads the date as shown on the page", () => {
    expect(parseDeadline("08 Aug 26, 02:29 PM EDT")).toBe("2026-08-08T00:00:00.000Z");
    expect(parseDeadline("Nov 5, 2026")).toBe("2026-11-05T00:00:00.000Z");
    expect(parseDeadline("2026-11-30")).toBe("2026-11-30T00:00:00.000Z");
    expect(parseDeadline("15/11/2026")).toBe("2026-11-15T00:00:00.000Z");
  });
  it("never guesses a missing year or a missing date", () => {
    expect(parseDeadline("Nov 15")).toBeNull();
    expect(parseDeadline("soon")).toBeNull();
    expect(parseDeadline(null)).toBeNull();
  });
});

describe("validateAgainstText: nothing the page does not say", () => {
  const page = { title: "Software Engineer Intern at Acme", text: "Acme Corp is hiring. Location: Pune. Stipend: Rs 20,000 per month. Open to final year B.Tech students." };
  it("drops values that are not on the page and keeps the ones that are", () => {
    const out = validateAgainstText(
      { title: "Software Engineer Intern", org: "Acme Corp", location: "Mumbai", reward: "Rs 20,000 per month", eligibilityText: "Open to all degrees", deadlineText: "31 Dec 2026", remote: true, evidenceSnippets: ["Open to final year B.Tech students.", "Free lunch provided"] },
      page,
    );
    expect(out.title).toBe("Software Engineer Intern");
    expect(out.org).toBe("Acme Corp");
    expect(out.reward).toBe("Rs 20,000 per month");
    expect(out.location).toBeNull(); // page says Pune
    expect(out.eligibilityText).toBeNull();
    expect(out.deadlineText).toBeNull();
    expect(out.remote).toBe(false); // the page never says remote
    expect(out.evidenceSnippets).toEqual(["Open to final year B.Tech students."]);
  });
});

describe("detectBlocked", () => {
  const body = "x".repeat(3000);
  it("flags login walls, captchas, 404s and empty pages, and passes real listings", () => {
    expect(detectBlocked({ title: "Sign in | LinkedIn", text: "Sign in to view this job. " + "a".repeat(400) })).toBe("login wall");
    expect(detectBlocked({ title: "Just a moment", text: "Verify you are human " + "a".repeat(400) })).toBe("captcha or bot check");
    expect(detectBlocked({ title: "Oops", text: "Page not found. " + "a".repeat(400) })).toBe("page not found");
    expect(detectBlocked({ title: "x", text: "short" })).toBe("empty content");
    expect(detectBlocked({ title: "Software Engineer Intern", text: "We are hiring a software engineer intern. " + body })).toBeNull();
  });
});

describe("canonicalUrl and dedupe", () => {
  it("ignores tracking params, www, fragments and trailing slashes", () => {
    const a = canonicalUrl("https://www.Hack2skill.com/event/datathon2026/?utm_source=x&utm_medium=y#top");
    expect(a).toBe(canonicalUrl("https://hack2skill.com/event/datathon2026"));
  });
  it("keeps one row per page, merging evidence", () => {
    const base: Opportunity = { type: "internship", title: "T", org: "O", eligibilityText: "", deadline: null, location: "", remote: false, reward: null, sourceUrl: "https://a.com/x/", fetchedAt: "2026-10-17T00:00:00.000Z", evidenceSnippets: ["one"] };
    const out = dedupeOpportunities([base, { ...base, sourceUrl: "https://a.com/x?utm_source=z", deadline: "2026-12-01T00:00:00.000Z", evidenceSnippets: ["two"] }]);
    expect(out).toHaveLength(1);
    expect(out[0].evidenceSnippets).toEqual(["one", "two"]);
  });
});

describe("normalizeOpportunity", () => {
  it("refuses fake URLs and records without title or org, and stores nothing it was not given", () => {
    expect(normalizeOpportunity({ title: "A", org: "B", type: "job" }, { sourceUrl: "https://example.com/x" })).toBeNull();
    expect(normalizeOpportunity({ title: "A", type: "job" }, { sourceUrl: "https://unstop.com/jobs/a-1234567" })).toBeNull();
    const o = normalizeOpportunity({ title: "A", org: "B", type: "job", evidenceSnippets: ["Open to all."] }, { sourceUrl: "https://unstop.com/jobs/a-1234567" })!;
    expect(o.deadline).toBeNull();
    expect(o.reward).toBeNull();
    expect(o.sourceSite).toBe("Unstop");
    expect(o.origin).toBe("live_fetch");
  });
});

describe("buildQueries", () => {
  const profile = { degree: "B.Tech", branch: "CSE", skills: ["React"], preferredRoles: ["SDE intern"], types: ["internship", "hackathon", "scholarship"] as const, locations: ["Delhi"], openToRemote: true };
  it("caps at 6, covers every wanted type and targets sites with site:", () => {
    const qs = buildQueries({ ...profile, types: [...profile.types] });
    expect(qs.length).toBeLessThanOrEqual(6);
    expect(new Set(qs.map((q) => q.type))).toEqual(new Set(profile.types));
    for (const q of qs) expect(q.query).toMatch(/site:/);
  });
  it("rotates the anchor site between runs", () => {
    const anchors = [0, 1, 2, 3].map((seed) => buildQueries({ ...profile, types: ["internship"] }, { seed })[0].sites[0]);
    expect(new Set(anchors).size).toBeGreaterThan(2);
  });
});

describe("planPages", () => {
  it("prefers detail pages, skips known and index pages, and limits pages per site", () => {
    const urls = [
      "https://internshala.com/internships/react-internship/",
      "https://unstop.com/hackathons/a-1000001",
      "https://unstop.com/hackathons/b-1000002",
      "https://unstop.com/hackathons/c-1000003",
      "https://unstop.com/hackathons/d-1000004",
      "https://hackaura.devfolio.co/",
    ];
    const known = new Set([canonicalUrl("https://unstop.com/hackathons/a-1000001")]);
    const { targets, rejected, indexPages } = planPages([{ type: "hackathon", urls }], [], { known, perSite: 2 });
    expect(targets.map((t) => t.url)).toEqual(["https://unstop.com/hackathons/b-1000002", "https://unstop.com/hackathons/c-1000003", "https://hackaura.devfolio.co/"]);
    expect(rejected.map((r) => r.reason)).toContain("index page (many listings)");
    expect(indexPages).toHaveLength(1);
  });
});

describe("runDiscovery", () => {
  const profile = { degree: "B.Tech", branch: "CSE", skills: ["React"], preferredRoles: ["SDE intern"], types: ["hackathon" as const], locations: ["Delhi"], openToRemote: true };
  const pageFor = (url: string) => ({ url, finalUrl: url, title: "Some Hackathon", text: "Some Hackathon by Acme. Open to all students. ".repeat(20) });
  const fakeDeps = (over: Partial<DiscoveryDeps> = {}): DiscoveryDeps => ({
    search: async () => [{ title: "t", snippet: "", url: "https://unstop.com/hackathons/a-1000001" }, { title: "t", snippet: "", url: "https://unstop.com/hackathons/b-1000002" }],
    fetchPages: async (urls) => ({ pages: urls.map(pageFor), errors: [] }),
    extractListing: async (page) => ({ isSingleListing: true, title: "Some Hackathon", org: "Acme", type: "hackathon", evidenceSnippets: ["Open to all students."], remote: false, eligibilityText: null, deadlineText: null, location: null, reward: null, applyUrl: null, _p: page.url } as never),
    checkLive: async () => ({ status: 200, dead: false }),
    fetchDetailLinks: async () => [],
    ...over,
  });

  it("saves each row through onRow as it is extracted and records HTTP status", async () => {
    const saved: Opportunity[] = [];
    const r = await runDiscovery(profile, { deps: fakeDeps(), hooks: { onRow: (o) => void saved.push(o) } });
    expect(r.opportunities.length).toBeGreaterThan(0);
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.every((o) => o.httpStatus === 200 && o.origin === "live_fetch")).toBe(true);
    expect(r.warning).toBeNull();
  });

  it("flags dead links", async () => {
    const r = await runDiscovery(profile, { deps: fakeDeps({ checkLive: async () => ({ status: 404, dead: true }) }) });
    expect(r.opportunities.every((o) => o.flag === "dead_link")).toBe(true);
  });

  it("reports a clear warning when every search fails", async () => {
    const r = await runDiscovery(profile, { deps: fakeDeps({ search: async () => { throw new Error("TinyFish responded 401"); } }) });
    expect(r.opportunities).toHaveLength(0);
    expect(r.warning).toMatch(/Live search unavailable/);
  });

  it("stops starting new extractions once the time budget is spent", async () => {
    const r = await runDiscovery(profile, { deps: fakeDeps(), hooks: { budgetMs: -1 } });
    expect(r.opportunities).toHaveLength(0);
    expect(r.budgetExceeded).toBe(true);
    expect(r.skipped.some((s) => s.reason.includes("budget"))).toBe(true);
  });

  it("skips pages that are blocked and never invents data for them", async () => {
    const r = await runDiscovery(profile, { deps: fakeDeps({ fetchPages: async (urls) => ({ pages: urls.map((u) => ({ url: u, finalUrl: u, title: "Sign in", text: "Sign in to view this page. " + "x".repeat(300) })), errors: [] }) }) });
    expect(r.opportunities).toHaveLength(0);
    expect(r.skipped.every((s) => s.reason.startsWith("blocked"))).toBe(true);
  });
});
