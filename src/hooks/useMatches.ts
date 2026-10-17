// React Query hooks for matches + the discover -> match pipeline. Owner: Dev D.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { MatchWithOpportunity } from "@/types";

async function post<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "POST" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json.data as T;
}

// Cached matches only: no discovery, no Gemini. Safe to call on every page load.
export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const res = await fetch("/api/match");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not load matches");
      return json.data.matches as MatchWithOpportunity[];
    },
  });
}

export type Stage = "searching" | "checking" | "scoring";

// Runs discovery, then matching. Discovery failures are non-fatal: we still match whatever is cached.
export function useFindOpportunities() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setWarning(null);
      setStage("searching");
      try {
        await post("/api/discover");
      } catch (e) {
        setWarning(`Live search failed (${e instanceof Error ? e.message : "unknown"}). Showing cached opportunities.`);
      }

      // Gate and scoring happen in one request; the stage label advances on a timer.
      setStage("checking");
      const timer = setTimeout(() => setStage("scoring"), 1500);
      try {
        return await post<{ matches: MatchWithOpportunity[] }>("/api/match");
      } finally {
        clearTimeout(timer);
      }
    },
    onSuccess: (data) => queryClient.setQueryData(["matches"], data.matches),
    onSettled: () => setStage(null),
  });

  return { ...mutation, stage, warning };
}
