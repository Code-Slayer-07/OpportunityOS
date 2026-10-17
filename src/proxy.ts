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
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

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
