// React Query hooks for matches and the background "find opportunities" job. Owner: Dev D.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/http";
import type { DiscoveryJob, MatchWithOpportunity } from "@/types";

// Cached matches only: no discovery, no Gemini. Safe to call on every page load.
export function useMatches({ polling = false }: { polling?: boolean } = {}) {
  return useQuery({
    queryKey: ["matches"],
    refetchInterval: polling ? 2000 : false,
    queryFn: async () => (await api<{ matches: MatchWithOpportunity[] }>("/api/match")).matches,
  });
}

const POLL_MS = 2000;

/**
 * Starts the search as a background job and follows it. POST returns { jobId } at once; we poll the job every 2 s,
 * and while it runs the matches list is refreshed so new cards appear as they are saved.
 * A page reload resumes the running job. A second job is rejected by the server (409), and we just follow the running one.
 */
export function useFindOpportunities() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [startedHere, setStartedHere] = useState(false);

  const latest = useQuery({
    queryKey: ["job", "latest"],
    queryFn: async () => (await api<{ job: DiscoveryJob | null }>("/api/discover")).job,
    staleTime: 0,
  });
  const resumable = latest.data?.status === "running" ? latest.data.id : null;
  const activeId = jobId ?? resumable;

  const job = useQuery({
    queryKey: ["job", activeId],
    enabled: !!activeId,
    queryFn: () => api<DiscoveryJob>(`/api/discover/${activeId}`),
    refetchInterval: (q) => (q.state.data?.status === "running" || !q.state.data ? POLL_MS : false),
  });

  const running = job.data?.status === "running" || (!!activeId && !job.data && !job.isError);

  // Show cards as they are saved, then refresh everything once when the job ends.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) {
      wasRunning.current = true;
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
    } else if (wasRunning.current) {
      wasRunning.current = false;
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    }
  }, [running, job.data?.found, job.data?.scored, queryClient]);

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/discover", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (res.status === 409 && json?.error?.jobId) return json.error.jobId as string; // already running: follow it
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not start the search");
      return json.data.jobId as string;
    },
    onSuccess: (id) => {
      setStartedHere(true);
      setJobId(id);
      void queryClient.invalidateQueries({ queryKey: ["job", id] });
    },
  });

  const current = job.data ?? null;
  return {
    start: () => start.mutate(),
    starting: start.isPending,
    startError: start.error?.message ?? null,
    job: current,
    running: running || start.isPending,
    // Only warn about a job this session started; an old finished job's warning is stale news.
    warning: startedHere ? (current?.warning ?? null) : null,
    failure: current?.status === "failed" ? (current.error ?? "The search failed") : null,
  };
}
