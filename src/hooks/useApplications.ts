// React Query hooks for the shortlist, with optimistic updates. Owner: Dev D.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toApplicationItem } from "@/lib/applications/item";
import { api } from "@/lib/http";
import { sortByPriority } from "@/lib/scoring/priority";
import type { ApplicationItem, ApplicationStatus, MatchWithOpportunity } from "@/types";

const KEY = ["applications"];

// Statuses that still need action. Applied/Interview/Result no longer count toward reminders.
export const isOpen = (a: ApplicationItem) => a.status === "Saved" || a.status === "Applying";

export function useApplications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<{ applications: ApplicationItem[] }>("/api/applications")).applications,
  });
}

// Shared optimistic plumbing: snapshot, apply `change` to the cached list, roll back on error, refetch when settled.
function useOptimistic<V, R>(mutationFn: (v: V) => Promise<R>, change: (list: ApplicationItem[], v: V) => ApplicationItem[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<ApplicationItem[]>(KEY);
      queryClient.setQueryData<ApplicationItem[]>(KEY, (list) => change(list ?? [], variables));
      return { previous };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(KEY, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveApplication() {
  return useOptimistic(
    (match: MatchWithOpportunity) =>
      api<ApplicationItem>("/api/applications", { method: "POST", body: JSON.stringify({ opportunityId: match.opportunityId }) }),
    (list, match) => {
      if (list.some((a) => a.opportunityId === match.opportunityId)) return list;
      const now = new Date().toISOString();
      const temp = toApplicationItem(
        { id: `temp-${match.opportunityId}`, opportunityId: match.opportunityId, status: "Saved", savedAt: now, updatedAt: now },
        match.opportunity,
        { score: match.score, reason: match.reason },
      );
      return sortByPriority([...list, temp]);
    },
  );
}

export function useUpdateApplicationStatus() {
  return useOptimistic(
    ({ id, status }: { id: string; status: ApplicationStatus }) =>
      api<ApplicationItem>(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    (list, { id, status }) => list.map((a) => (a.id === id ? { ...a, status } : a)),
  );
}

export function useRemoveApplication() {
  return useOptimistic(
    (id: string) => api<{ id: string }>(`/api/applications/${id}`, { method: "DELETE" }),
    (list, id) => list.filter((a) => a.id !== id),
  );
}
