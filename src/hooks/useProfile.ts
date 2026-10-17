// React Query hooks for /api/profile. Owner: Dev D.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";

// GET /api/profile shape: unfilled columns come back as null.
export interface ProfileResponse {
  id: string;
  name: string | null;
  email: string | null;
  degree: string | null;
  branch: string | null;
  gradYear: number | null;
  currentStatus: string | null;
  cgpa: number | null;
  skills: string[] | null;
  preferredRoles: string[] | null;
  experienceLevel: string | null;
  types: string[] | null;
  locations: string[] | null;
  openToRemote: boolean | null;
  availabilityDate: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  profileComplete: boolean;
}

const request = <T,>(init?: RequestInit) => api<T>("/api/profile", init);

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: () => request<ProfileResponse>() });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => request<ProfileResponse>({ method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (data) => queryClient.setQueryData(["profile"], data),
  });
}
