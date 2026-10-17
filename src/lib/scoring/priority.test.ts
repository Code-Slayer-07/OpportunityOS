import { describe, expect, it } from "vitest";
import { daysLeft, priority, priorityReason, sortByPriority, urgencyLevel, urgencyMultiplier } from "./priority";

const NOW = new Date("2026-10-17T15:30:00Z");

describe("daysLeft", () => {
  it("counts whole days by date, ignoring time of day", () => {
    expect(daysLeft("2026-10-17T00:00:00.000Z", NOW)).toBe(0);
    expect(daysLeft("2026-10-19T00:00:00.000Z", NOW)).toBe(2);
    expect(daysLeft("2026-10-16T00:00:00.000Z", NOW)).toBe(-1);
    expect(daysLeft(null, NOW)).toBeNull();
  });
});

describe("urgencyLevel", () => {
  it.each([
    [null, "none"],
    [-1, "grey"],
    [0, "red"],
    [2, "red"],
    [3, "amber"],
    [7, "amber"],
    [8, "green"],
  ] as const)("%s days -> %s", (days, level) => expect(urgencyLevel(days)).toBe(level));
});

describe("urgencyMultiplier", () => {
  it.each([
    [0, 2.0],
    [1, 2.0],
    [2, 1.7],
    [3, 1.3],
    [7, 1.3],
    [8, 1.1],
    [14, 1.1],
    [15, 1.0],
    [-1, 0.2],
    [null, 1.0],
  ] as const)("%s days -> x%s", (days, m) => expect(urgencyMultiplier(days)).toBe(m));
});

describe("priority + sort", () => {
  it("multiplies fit by urgency", () => {
    expect(priority(80, 1)).toBe(160);
    expect(priority(80, 30)).toBe(80);
  });

  it("orders by priority desc with passed items last, even if they score high", () => {
    const items = [
      { id: "far-high", priority: priority(90, 30), daysLeft: 30 },
      { id: "passed-high", priority: priority(99, -2), daysLeft: -2 },
      { id: "soon-mid", priority: priority(60, 2), daysLeft: 2 },
      { id: "none", priority: priority(70, null), daysLeft: null },
    ];
    expect(sortByPriority(items).map((i) => i.id)).toEqual(["soon-mid", "far-high", "none", "passed-high"]);
  });
});

describe("priorityReason", () => {
  it("reads naturally", () => {
    expect(priorityReason(82, 2)).toBe("Strong match (82) and closes in 2 days");
    expect(priorityReason(60, 1)).toBe("Good match (60) and closes tomorrow");
    expect(priorityReason(40, null)).toBe("Possible match (40), no deadline listed");
  });
});
