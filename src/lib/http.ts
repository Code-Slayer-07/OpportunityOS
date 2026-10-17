// Client-side fetch for our own API: unwraps { data } and throws the { error: { message } } text.
export const NETWORK_ERROR = "Couldn't load this. Check your connection and retry.";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    // Offline, blocked or the server is down: "Failed to fetch" means nothing to a user.
    throw new ApiError(NETWORK_ERROR);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error?.message ?? (res.status >= 500 ? NETWORK_ERROR : "Request failed"), res.status);
  return json.data as T;
}

/** React Query retry rule: one retry, and none for client errors (4xx), which will not change on retry. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : undefined;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}
