# OpportunityOS

**Find what matters. Prove it's real. Never miss a deadline.**

OpportunityOS helps students find live opportunities (internships, jobs, hackathons, scholarships), proves they qualify with **quoted evidence**, and tracks deadlines.

Flow: Auth → Profile → Discover → Matches (with evidence) → Action Plan. Product spec: [docs/prd.md](docs/prd.md). Deploying: [DEPLOY.md](DEPLOY.md). Demo: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Pitch: [docs/PITCH_OUTLINE.md](docs/PITCH_OUTLINE.md).

## Architecture

```
Browser (Next.js App Router, React Query, Tailwind)
   │  fetch /api/*  (session cookie)
   ▼
src/proxy.ts ── refreshes the Supabase session, blocks unauthenticated /api and app pages
   ▼
Route Handlers (src/app/api)          every handler: requireUser → Zod validate → { data } | { error: { message } }
   ├─ /profile        GET/PUT           profile CRUD, computes profile_complete
   ├─ /discover       POST              TinyFish Search → TinyFish Agent (structured extraction) → normalise → dedupe → upsert
   ├─ /opportunities  GET               cached opportunities only (never the web)
   ├─ /match          GET/POST          rule gate → Gemini (JSON mode) → Zod → evidence check → fallback → upsert
   ├─ /applications   GET/POST          shortlist with computed urgency + priority
   ├─ /applications/[id]  PATCH/DELETE  move status / remove
   └─ /health         GET               public liveness check
   ▼
Supabase Postgres (RLS on every table) + Supabase Auth
```

One unified `Opportunity` model and one pipeline serve all four types; a type is just a field plus its own search queries.

## Data flow

1. **Discover** (`src/lib/discovery`): `buildQueries(profile)` makes up to 6 queries (at least one per wanted type, biased to Internshala, Unstop, Devfolio, Devpost, MLH, Buddy4Study, Wellfound). TinyFish **Search** returns URLs (max 12 pages per run). TinyFish **Agent** reads each page with a structured `output_schema` and returns title, org, type, eligibility, deadline, location, remote, reward and verbatim evidence snippets, 4 pages at a time. `normalize` parses deadlines to ISO and flags records `expired` or `incomplete` instead of dropping them; `dedupe` merges on lowercase org + title + deadline date; rows are upserted into `opportunities` with the service-role client.
2. **Rule gate** (`src/lib/matching/ruleGate.ts`, pure): drops opportunities of an unwanted type, with a passed deadline, or a non-matching location (internships and jobs only). Degree, branch, graduation batch and "final year" are enforced only when the listing states them clearly; unclear means pass.
3. **Gemini** (`gemini.ts`, `prompt.ts`, `schema.ts`): survivors are scored in JSON mode (skills 40, role 25, deadline 20, location 15; eligibility is a gate, not a weight). Output is Zod-validated; one retry; then a rule-based fallback score. Quotes that do not appear verbatim in the listing are removed; `sourceUrl` and `fetchedAt` always come from the opportunity.
4. **Matches**: upserted per user (max 15 new per run, 3 Gemini calls in parallel, matches under 24 h old are reused). `GET /api/match` serves the cache.
5. **Applications** (`src/lib/applications`, `src/lib/scoring/priority.ts`): saved items carry a status (Saved, Applying, Applied, Interview, Result), a computed urgency (red under 3 days, amber 3-7, green over 7, grey passed) and `priority = fit score × urgency multiplier`, with passed deadlines last.

## Folder ownership

| Owner | Area | Paths |
| --- | --- | --- |
| **Dev A** Backend / Data / Auth | DB, auth, profile + applications API, shared types and schemas | `supabase/`, `src/proxy.ts`, `src/app/(auth)`, `src/app/auth`, `src/app/api/{profile,applications,health}`, `src/lib/{supabase,auth,validation,applications}`, `src/lib/api.ts`, `src/types` |
| **Dev B** Discovery | TinyFish search/extract, normalise, dedupe, seed | `src/lib/discovery`, `src/app/api/{discover,opportunities}`, `scripts/` |
| **Dev C** Match engine | Rule gate, Gemini, priority scoring | `src/lib/matching`, `src/lib/scoring`, `src/app/api/match` |
| **Dev D** Frontend / Demo | Pages, components, hooks | `src/app/page.tsx`, `src/app/(app)`, `src/components`, `src/hooks`, `docs/` |

Changes to `src/types/index.ts` affect everyone: open a PR and tag the other devs.

## Setup

Requires Node 20+ and npm.

1. **Create a Supabase project** at <https://supabase.com/dashboard>.
2. **Run the migrations** in the SQL Editor, in order: `supabase/migrations/0001_init.sql`, `0002_opportunity_flag.sql`, `0003_indexes.sql`.
3. **Auth settings** (*Authentication → Providers → Email*): turn **off** "Confirm email" for the demo so signup logs the user in immediately.
4. **Environment:** copy `.env.example` to `.env.local` and fill it in (Supabase URL and keys, `TINYFISH_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SITE_URL`). Never commit `.env.local`.
5. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   Open <http://localhost:3000>.

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm test` | Vitest unit tests (rule gate, matcher fallbacks, priority maths, seed data) |
| `npm run prefetch` | Create the demo user, load and score demo data, print a summary (`-- --refresh` live discovery, `-- --reseed` fresh seed deadlines) |

### Environment variables

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client config |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Writes to `opportunities`; never reaches the client bundle |
| `TINYFISH_API_KEY` (+ optional `TINYFISH_SEARCH_URL`, `TINYFISH_AGENT_URL`, `TINYFISH_EXTRACT_TIMEOUT_MS`) | Discovery |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Matching (default model `gemini-3.1-flash-lite`) |
| `NEXT_PUBLIC_SITE_URL` | Site URL used for auth redirects |
| `DEMO_MODE=true` | `/api/discover` never touches the web; serves cached/seeded data; stored matches never expire |
| `MATCH_CACHE_ONLY=true` | `/api/match` serves stored matches only (no Gemini) |

## Demo mode

`npm run prefetch` pre-loads the demo user (`demo@opportunityos.dev`) with scored matches; with `DEMO_MODE=true` the whole flow runs from cache in about a second per step. `scripts/seed-fallback.json` holds 17 **synthetic** sample listings with fictional organisations; replace them with verified real listings before presenting them as real. Details in [DEPLOY.md](DEPLOY.md) and [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Reliability and security

- TinyFish search: 15 s timeout, one retry. Agent extraction: 120 s timeout, one retry on network/429/5xx (not on timeout); one bad URL never fails a run. Gemini: 25 s timeout, one retry, then a rule-based score. Matching never throws.
- Every `/api` route except `/api/health` requires a session (proxy plus `requireUser`). Bodies are validated with Zod. Errors are `{ error: { message } }`.
- Row Level Security is on `profiles`, `matches`, `applications` and `opportunities` (readable by signed-in users, writable only with the service role). Verified with a second user.
- Server keys stay server-side (checked by grepping the client bundle). Logs contain counts, not page content or keys.

## Known limitations

- **Live discovery is slow and costs credits.** The browser agent takes roughly 30-100 s per page; a full run takes minutes and will not fit short serverless time limits. Production uses `DEMO_MODE` plus pre-fetched data.
- **Demo data is synthetic.** The seed set uses fictional organisations and is not verified.
- **Evidence is checked against the extracted listing text,** not re-fetched from the live page. Agent extraction can miss or misread a page; the card shows the fetch date and a source link so users can verify.
- **The rule gate is heuristic** (regex over eligibility text) and deliberately conservative. Deadlines need an explicit year to be parsed; deadline dates are treated as UTC days.
- **Reminders are in-app only** (banner and navbar badge). No email or push. Google sign-in is a TODO (`src/app/auth/callback/route.ts`).
- **UI gaps:** no drag-and-drop on the board (status dropdown instead); optional CGPA and availability date cannot be cleared once saved; mobile widths were reasoned about, not tested on physical devices.
- **Matching cap:** at most 15 new opportunities are scored per run.
- **Tooling:** TypeScript is pinned to 6.x because `typescript-eslint` does not yet support 7.
- Supabase is required even in demo mode; `DEMO_MODE` removes only the TinyFish and Gemini dependencies.

## Branching rule

Work on feature branches (`feat/<area>-<thing>`, e.g. `feat/discovery-normalize`) and open a pull request. **Never push directly to `main`.**
