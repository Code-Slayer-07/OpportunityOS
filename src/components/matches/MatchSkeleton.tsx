export function MatchSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="h-14 w-14 shrink-0 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/3 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-4/5 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
