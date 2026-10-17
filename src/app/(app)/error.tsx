"use client";

import { Button } from "@/components/ui/Button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h1 className="text-lg font-semibold text-red-800">Something went wrong</h1>
      <p className="mt-2 text-sm text-red-700">We couldn’t load this page. Your saved data is safe.</p>
      {error.digest && <p className="mt-1 text-xs text-red-400">Reference: {error.digest}</p>}
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
