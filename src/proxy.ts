// Route protection + session refresh (Next 16 name for "middleware"). Owner: Dev A.
import { NextResponse, type NextRequest } from "next/server";
import { authRedirect, isPrefetch, isRsc, needsProfileLookup } from "@/lib/routing";
import { updateSession } from "@/lib/supabase/middleware";

// Copy refreshed session cookies onto a redirect so the browser keeps them.
function redirectTo(request: NextRequest, path: string, from: NextResponse) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
  const { response, user, supabase } = session;

  // API clients get a JSON 401 (not an HTML redirect to /login).
  if (!user && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  // Signed-in users on /login or /signup go to /matches (complete profile) or /profile.
  let profileComplete = false;
  if (user && needsProfileLookup(pathname)) {
    try {
      const { data } = await supabase.from("profiles").select("profile_complete").eq("id", user.id).maybeSingle();
      profileComplete = !!data?.profile_complete;
    } catch {
      // Treat as incomplete: /profile is always a safe landing page.
    }
  }

  const target = authRedirect({ pathname, signedIn: !!user, profileComplete });
  if (!target) return response;

  // Background route prefetches would only follow the redirect and log a 404 in the console: answer them with an empty
  // 204. Real navigations are redirected; RSC fetches keep their _rsc query so the client still receives an RSC payload.
  if (isPrefetch(request.headers)) return new NextResponse(null, { status: 204 });
  return redirectTo(request, isRsc(request.headers, search) ? `${target}${search}` : target, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
