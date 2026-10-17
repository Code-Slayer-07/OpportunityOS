import { describe, expect, it } from "vitest";
import { authRedirect, isPrefetch, isRsc } from "./routing";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("authRedirect", () => {
  it("sends signed-out users from protected pages to /login", () => {
    for (const p of ["/profile", "/matches", "/action-plan", "/matches/x"]) {
      expect(authRedirect({ pathname: p, signedIn: false, profileComplete: false })).toBe("/login");
    }
    expect(authRedirect({ pathname: "/login", signedIn: false, profileComplete: false })).toBeNull();
    expect(authRedirect({ pathname: "/", signedIn: false, profileComplete: false })).toBeNull();
  });

  it("sends signed-in users away from /login and /signup by profile completeness", () => {
    expect(authRedirect({ pathname: "/login", signedIn: true, profileComplete: true })).toBe("/matches");
    expect(authRedirect({ pathname: "/signup", signedIn: true, profileComplete: true })).toBe("/matches");
    expect(authRedirect({ pathname: "/login", signedIn: true, profileComplete: false })).toBe("/profile");
    expect(authRedirect({ pathname: "/signup", signedIn: true, profileComplete: false })).toBe("/profile");
  });

  it("leaves signed-in users on app pages alone", () => {
    expect(authRedirect({ pathname: "/profile", signedIn: true, profileComplete: false })).toBeNull();
  });
});

describe("request kind", () => {
  it("recognises RSC and prefetch requests", () => {
    expect(isPrefetch(h({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetch(h({}))).toBe(false);
    expect(isRsc(h({ rsc: "1" }), "")).toBe(true);
    expect(isRsc(h({}), "?_rsc=abc")).toBe(true);
    expect(isRsc(h({}), "?q=1")).toBe(false);
  });
});
