// Pure routing rules for src/proxy.ts. Owner: Dev A.
export const PROTECTED_PAGES = ["/profile", "/matches", "/action-plan"];
export const AUTH_PAGES = ["/login", "/signup"];

const matchesPath = (pathname: string, bases: string[]) => bases.some((base) => pathname === base || pathname.startsWith(`${base}/`));

/**
 * Where should this request be redirected, if anywhere?
 * - signed out on a protected page -> /login
 * - signed in on /login or /signup -> /matches when the profile is complete, otherwise /profile
 */
export function authRedirect({ pathname, signedIn, profileComplete }: { pathname: string; signedIn: boolean; profileComplete: boolean }): string | null {
  if (!signedIn) return matchesPath(pathname, PROTECTED_PAGES) ? "/login" : null;
  if (matchesPath(pathname, AUTH_PAGES)) return profileComplete ? "/matches" : "/profile";
  return null;
}

export const needsProfileLookup = (pathname: string) => matchesPath(pathname, AUTH_PAGES);

type Headers = { get(name: string): string | null };

/** Next's client router prefetches routes in the background; those must not be answered with an HTML redirect. */
export function isPrefetch(headers: Headers): boolean {
  return headers.get("next-router-prefetch") === "1" || headers.get("purpose") === "prefetch" || !!headers.get("next-router-segment-prefetch");
}

export const isRsc = (headers: Headers, search: string) => headers.get("rsc") === "1" || /(^|[?&])_rsc=/.test(search);
