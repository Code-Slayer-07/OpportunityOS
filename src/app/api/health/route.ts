// GET /api/health — public liveness check. Reveals no configuration or secrets. Owner: Dev A.
import { ok } from "@/lib/api";

export function GET() {
  return ok({ status: "ok", time: new Date().toISOString() });
}
