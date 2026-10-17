// Consistent JSON envelope for route handlers: { data } or { error: { message } }. Owner: Dev A.
import { NextResponse } from "next/server";

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });

export const fail = (message: string, status = 400) =>
  NextResponse.json({ error: { message } }, { status });

// Wrap a route handler so an unexpected throw becomes a JSON { error } instead of an HTML 500.
export const safe =
  <A extends unknown[]>(handler: (...args: A) => Promise<Response>) =>
  async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error("[api] unhandled:", e instanceof Error ? e.message : "unknown error");
      return fail("Something went wrong. Please try again.", 500);
    }
  };
