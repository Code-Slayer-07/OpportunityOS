import { MatchSkeleton } from "@/components/matches/MatchSkeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" role="status" aria-label="Loading">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-gray-200" />
      <MatchSkeleton count={3} />
    </div>
  );
}
