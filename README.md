# OpportunityOS

**Find what matters. Prove it's real. Never miss a deadline.**

OpportunityOS helps students find live opportunities (internships, jobs, hackathons, scholarships), proves they qualify with quoted evidence, and tracks deadlines.

Flow: Auth → Profile → Discover → Matches (with evidence) → Action Plan. See [docs/prd.md](docs/prd.md).

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Zod · React Query. Backend = Next.js Route Handlers. Discovery (TinyFish) and matching (Gemini) are placeholders for now.

## Setup

Requires Node 20+ and npm.

1. **Create a Supabase project** at <https://supabase.com/dashboard>.
2. **Run the migration:** open *SQL Editor*, paste [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql), and run it. (Or `supabase db push` if you use the CLI.)
3. **Auth settings** (*Authentication → Providers → Email*): for the demo, turn **off** "Confirm email" so signup logs the user in immediately.
4. **Environment:** `cp .env.example .env.local` and fill in the values. URL and anon key are under *Project Settings → API*. Never commit `.env.local`.
5. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   Open <http://localhost:3000>.

`npm run build` creates a production build.

## Folder ownership

| Owner | Area | Paths |
| --- | --- | --- |
| **Dev A** — Backend / Data / Auth | DB, auth, profile + applications API, shared types and schemas | `supabase/`, `src/proxy.ts`, `src/app/(auth)`, `src/app/auth`, `src/app/api/profile`, `src/app/api/applications`, `src/lib/supabase`, `src/lib/auth`, `src/lib/validation`, `src/lib/api.ts`, `src/types` |
| **Dev B** — Discovery | TinyFish search/fetch, normalize, dedupe | `src/lib/discovery`, `src/app/api/discover`, `src/app/api/opportunities`, `scripts/prefetch-demo.ts` |
| **Dev C** — Match engine | Rule gate, Gemini matching, priority scoring | `src/lib/matching`, `src/lib/scoring`, `src/app/api/match` |
| **Dev D** — Frontend / Demo | Pages, components, hooks, demo polish | `src/app/(app)`, `src/components/{profile,matches,action-plan}`, `src/components/ui`, `src/hooks` |

Changes to `src/types/index.ts` affect everyone: open a PR and tag the other devs.

## Conventions

- Route handlers return `{ data }` on success and `{ error: { message } }` on failure (see `src/lib/api.ts`). Guard authenticated handlers with `requireUser()` (`src/lib/auth/requireUser.ts`).
- Secrets live only in `.env.local`. `SUPABASE_SERVICE_ROLE_KEY`, `TINYFISH_API_KEY` and `GEMINI_API_KEY` are server-only: never prefix them with `NEXT_PUBLIC_`.
- `@/` maps to `src/`.

## Branching rule

Work on feature branches (`feat/<area>-<thing>`, e.g. `feat/discovery-normalize`) and open a pull request. **Never push directly to `main`.**

## Discovery

Live discovery uses TinyFish. Code: `src/lib/discovery/`, routes: `POST /api/discover`, `GET /api/opportunities`. Server-side only; needs `TINYFISH_API_KEY` (optional `TINYFISH_SEARCH_URL`, `TINYFISH_AGENT_URL`, `TINYFISH_EXTRACT_TIMEOUT_MS`).

**Flow of `POST /api/discover`** (authenticated, uses the caller's saved profile):

1. `buildQueries` makes up to **6** search queries, at least one per wanted type, biased to sources such as Internshala, Unstop, Devfolio, Devpost, MLH, Buddy4Study and Wellfound.
2. TinyFish **Search** (`GET api.search.tinyfish.ai`) runs each query (15s timeout, one retry).
3. URLs are interleaved across queries, de-duplicated, social sites dropped, and capped at **12 pages** per run.
4. TinyFish **Agent** (`POST agent.tinyfish.ai/v1/automation/run`) reads each page with a structured `output_schema` and verbatim evidence snippets, **4 at a time**. Fetch is not used because it returns raw text, not structured fields.
5. `normalize` maps the result to the `Opportunity` model and parses deadlines to ISO dates. Records are kept with a `flag`: `expired` (deadline passed) or `incomplete` (missing title/org/source/evidence, or an unreadable deadline). Pages that are not a single identifiable opportunity are reported in `skipped`.
6. `dedupe` collapses duplicates (lowercase org + title + deadline date), then rows are upserted into `opportunities` with the service-role client; `fetched_at` is refreshed on re-fetch.
7. Response: `{ data: { count, opportunities, skipped } }`. One failing URL never fails the run.

`GET /api/opportunities?type=internship|job|hackathon|scholarship` reads the cache only (sorted by deadline, no web calls). `expired` is recomputed on read.

**Limits and costs**
- Each agent extraction takes roughly 30-100s and uses TinyFish credits; Search is free (12,000/day). A full run can take several minutes. The route allows up to 300s and stops starting new pages after 170s, so for live demos pre-run discovery (`scripts/prefetch-demo.ts`).
- Requires migration `0002_opportunity_flag.sql` (adds `opportunities.flag`).

## Matching

Code: `src/lib/matching/`, route: `POST /api/match` (authenticated, no web calls). Tests: `npm test`.

1. **Rule gate** (`ruleGate.ts`, pure): drops opportunities of an unwanted type, with a passed deadline (no deadline = pass), or a non-matching location (internships/jobs only; remote listings pass if you are open to remote). Degree, branch, graduation batch and "final year" are only enforced when the listing states them clearly; anything unclear passes.
2. **Gemini** (`gemini.ts`, `prompt.ts`, `schema.ts`): survivors are scored in JSON mode (`GEMINI_MODEL`, default `gemini-3.1-flash-lite`). Weights: skills 40, role 25, deadline 20, location 15; eligibility is a gate, not a weight. Output is validated with Zod; one retry on timeout/invalid JSON.
3. **Evidence is checked**: quotes that do not appear verbatim in the listing are dropped, and `sourceUrl`/`fetchedAt` are copied from the opportunity, never from the model. If no quote survives, the listing's own evidence snippet is used.
4. **Fallback** (`fallback.ts`): if Gemini fails twice, a rule-based score is stored with reason "AI reasoning unavailable, showing rule-based score", no evidence and gap "Reasoning unavailable". The matcher never throws.

**Limits:** max 15 opportunities per run, 3 Gemini calls in parallel, and opportunities matched in the last 24h are skipped. The response contains all of the user's matches (new and cached) that still pass the gate, joined with their opportunity, sorted by score.

## Demo mode (never fetch live on stage)

1. Run migrations `0001`-`0003` in the Supabase SQL editor.
2. Pre-cache: `npm run prefetch`. It creates/updates the demo user (`demo@opportunityos.dev`, password `demo-password-123`, override with `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`), loads the seed set if fewer than 10 opportunities are cached, scores them with Gemini and prints a summary table.
   - `npm run prefetch -- --refresh` does a real TinyFish discovery and re-scores everything.
   - `npm run prefetch -- --reseed` replaces the synthetic seed set (its deadlines are relative to today, so reseed on the day of the demo).
3. Set `DEMO_MODE=true` in `.env.local`. `POST /api/discover` then makes **no web calls**: it ensures the seed set exists and serves the cache, and stored matches never expire, so `POST /api/match` only scores what is missing. Add `MATCH_CACHE_ONLY=true` to never call Gemini at all.

`scripts/seed-fallback.json` holds 17 **synthetic** placeholder listings (fictional organisations). Swap in hand-verified real listings before presenting them as real. Supabase itself is still required; DEMO_MODE only removes the TinyFish and Gemini dependencies.

## Reliability and security notes

- TinyFish search: 15s timeout + one retry. Agent extraction: 120s timeout, one retry on network/429/5xx (not on timeout), one bad URL never fails the run. Gemini: 25s timeout, one retry, then a rule-based score. Matching never throws.
- Every `/api` route except `/api/health` requires a session (checked in the proxy and again by `requireUser`). Request bodies are validated with Zod. Unexpected errors return `{ error: { message } }` JSON.
- Row Level Security is enabled on `profiles`, `matches`, `applications` and `opportunities`. The service-role key is used only on the server (`src/lib/supabase/admin.ts`) and does not appear in the client bundle (checked by grepping `.next/static`).
- `GET /api/health` is public and returns only `{ status, time }`.
