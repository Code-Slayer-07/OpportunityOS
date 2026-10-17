import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, NETWORK_ERROR, api, shouldRetry } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("turns a network failure into a friendly message", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(api("/x")).rejects.toThrow(NETWORK_ERROR);
  });

  it("keeps the server message for 4xx and unwraps data", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "Nope" } }), { status: 400 }));
    await expect(api("/x")).rejects.toMatchObject({ message: "Nope", status: 400 });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ data: { a: 1 } }), { status: 200 }));
    await expect(api("/x")).resolves.toEqual({ a: 1 });
  });
});

describe("shouldRetry", () => {
  it("retries once, never on 4xx", () => {
    expect(shouldRetry(0, new ApiError("x", 500))).toBe(true);
    expect(shouldRetry(1, new ApiError("x", 500))).toBe(false);
    expect(shouldRetry(0, new ApiError("x", 404))).toBe(false);
    expect(shouldRetry(0, new ApiError("x"))).toBe(true);
  });
});
