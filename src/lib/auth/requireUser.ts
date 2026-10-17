// Route-handler guard. Owner: Dev A.
// Usage:
//   const auth = await requireUser();
//   if (auth.response) return auth.response;
//   const { user, supabase } = auth;
import { fail } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: fail("Unauthorized", 401), user: null, supabase };
  }
  return { response: null, user, supabase };
}
