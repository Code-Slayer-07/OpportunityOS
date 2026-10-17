"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { shouldRetry } from "@/lib/http";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: shouldRetry } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
