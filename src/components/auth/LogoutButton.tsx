"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await createClient().auth.signOut();
    // Hard navigation: the session just ended, so reload everything instead of letting the router refetch the old page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page load on purpose: the session changed
    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
