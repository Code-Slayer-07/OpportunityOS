// Route protection + session refresh (Next 16 name for "middleware"). Owner: Dev A.
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PAGES = ["/profile", "/matches", "/action-plan"];
const AUTH_PAGES = ["/login", "/signup"];

const matchesPath = (pathname: string, bases: string[]) =>
  bases.some((base) => pathname === base || pathname.startsWith(`${base}/`));

// Copy refreshed session cookies onto a redirect so the browser keeps them.
function redirectTo(request: NextRequest, path: string, from: NextResponse) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/health") return NextResponse.next(); // public liveness check

  let session: Awaited<ReturnType<typeof updateSession>>;
  try {
    session = await updateSession(request);
  } catch {
    // Supabase unreachable: fail the request cleanly instead of crashing the proxy.
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: { message: "Authentication service unavailable" } }, { status: 503 })
      : NextResponse.next();
  }
  const { response, user } = session;

  if (!user) {
    // API clients get a JSON 401 (not an HTML redirect to /login).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }
    if (matchesPath(pathname, PROTECTED_PAGES)) return redirectTo(request, "/login", response);
  } else if (matchesPath(pathname, AUTH_PAGES)) {
    return redirectTo(request, "/profile", response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
