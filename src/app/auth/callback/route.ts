// Supabase code exchange. Owner: Dev A.
// TODO(Google OAuth): not implemented. To add later, enable the Google provider in the Supabase
// dashboard and call supabase.auth.signInWithOAuth({ provider: "google",
// options: { redirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback` } }) from the login page.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  // Only allow same-site relative redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
