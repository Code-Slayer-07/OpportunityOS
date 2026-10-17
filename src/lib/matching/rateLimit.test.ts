import { afterEach, describe, expect, it } from "vitest";
import { acquireSlot, resetRateLimit, retryAfterMs } from "./rateLimit";

afterEach(() => {
  resetRateLimit();
  delete process.env.GEMINI_RPM;
});

describe("rate limit", () => {
  it("lets RPM requests through at once, then makes the next one wait for the window", async () => {
    process.env.GEMINI_RPM = "2";
    let t = 0;
    await acquireSlot("m", () => t);
    await acquireSlot("m", () => t);
    // third request: the window (60 s) has not elapsed and waiting exceeds the cap, so it is refused rather than hanging
    await expect(acquireSlot("m", () => t)).rejects.toThrow(/rate limit/);
    t = 61_000;
    await expect(acquireSlot("m", () => t)).resolves.toBeUndefined();
  });

  it("limits each model separately", async () => {
    process.env.GEMINI_RPM = "1";
    await acquireSlot("a", () => 0);
    await expect(acquireSlot("b", () => 0)).resolves.toBeUndefined();
  });

  it("reads Gemini's retry hint", () => {
    expect(retryAfterMs("Please retry in 23.5s.")).toBe(23_750);
    expect(retryAfterMs("nothing here")).toBeNull();
  });
});
