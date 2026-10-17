// Client-side rate limit for the Gemini API. Owner: Dev C.
// The free tier allows about 15 requests per minute PER MODEL; going over returns 429 "quota exceeded".
// Each model gets its own sliding window, and a call waits (up to a cap) for a free slot instead of failing.
const WINDOW_MS = 60_000;
const MAX_WAIT_MS = 25_000;

const calls = new Map<string, number[]>();

export const geminiRpm = () => Math.max(1, Number(process.env.GEMINI_RPM) || 13);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves when a request to `model` may be sent; rejects if no slot frees up within the cap. */
export async function acquireSlot(model: string, now = () => Date.now()): Promise<void> {
  const started = now();
  for (;;) {
    const t = now();
    const recent = (calls.get(model) ?? []).filter((x) => t - x < WINDOW_MS);
    if (recent.length < geminiRpm()) {
      recent.push(t);
      calls.set(model, recent);
      return;
    }
    const wait = WINDOW_MS - (t - recent[0]) + 50;
    if (now() - started + wait > MAX_WAIT_MS) throw new Error(`Gemini rate limit: no free request slot for ${model} within ${MAX_WAIT_MS / 1000}s`);
    calls.set(model, recent);
    await sleep(Math.min(wait, 1_000));
  }
}

/** "Please retry in 23.5s" from a 429 body, in ms (null if absent). */
export function retryAfterMs(body: string): number | null {
  const m = body.match(/retry in ([\d.]+)s/i);
  return m ? Math.ceil(Number(m[1]) * 1000) + 250 : null;
}

export const resetRateLimit = () => calls.clear();
