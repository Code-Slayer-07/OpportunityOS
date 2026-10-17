// Runs once when the server starts.
//
// DEMO_MODE makes zero external calls by default, so nothing happens here unless you opt in with
// DEMO_PRESCORE_ON_START=true: then, if the demo account has no AI matches yet, it is pre-scored in the background.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DEMO_MODE !== "true" || process.env.DEMO_PRESCORE_ON_START !== "true") return;

  void (async () => {
    try {
      const [{ createAdminClient }, { DEMO_EMAIL, findUserIdByEmail, prescoreUser }] = await Promise.all([import("@/lib/supabase/admin"), import("@/lib/matching/prescore")]);
      const admin = createAdminClient();
      const userId = await findUserIdByEmail(admin, DEMO_EMAIL());
      if (!userId) return console.log("[demo] no demo user yet; run npm run demo:prepare");
      const { count } = await admin.from("matches").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_fallback", false);
      if ((count ?? 0) > 0) return console.log(`[demo] demo user already has ${count} AI matches`);
      console.log("[demo] demo user has no matches; pre-scoring in the background");
      const { matches } = await prescoreUser(admin, userId);
      console.log(`[demo] pre-scored ${matches.length} matches`);
    } catch (e) {
      console.warn("[demo] startup pre-scoring failed:", e instanceof Error ? e.message : e);
    }
  })();
}
