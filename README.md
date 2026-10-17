# OpportunityOS

**Find what matters. Prove it's real. Never miss a deadline.**

OpportunityOS helps students find live opportunities (internships, jobs, hackathons, scholarships), proves they qualify with **quoted evidence**, and tracks deadlines. **All data comes from real pages fetched from the live web, and every card links back to the original page.**

Flow: Auth → Profile → Discover → Matches (with evidence) → Action Plan. Product spec: [docs/prd.md](docs/prd.md). Deploying: [DEPLOY.md](DEPLOY.md). Demo: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Pitch: [docs/PITCH_OUTLINE.md](docs/PITCH_OUTLINE.md). Test results: [TEST_REPORT.md](TEST_REPORT.md).

## Architecture

```
Browser (Next.js App Router, React Query, Tailwind)
   │  fetch /api/*  (session cookie); polls the discovery job every 2 s
   ▼
src/proxy.ts ── refreshes the Supabase session, blocks unauthenticated /api and app pages
   ▼
Route Handlers (src/app/api)          every handler: requireUser → Zod validate → { data } | { error: { message } }
   ├─ /profile            GET/PUT        profile CRUD, computes profile_complete
   ├─ /discover           POST/GET       start a background search → { jobId }; latest job
   ├─ /discover/[jobId]   GET            job status: searching, extracting n/m, matching, done/partial/failed
   ├─ /opportunities      GET            cached opportunities only (never the web)
   ├─ /match              GET/POST       rule gate → Gemini (batched JSON mode) → Zod → evidence check
   ├─ /applications       GET/POST       shortlist with computed urgency + priority
   ├─ /applications/[id]  PATCH/DELETE   move status / remove
   └─ /health             GET            public liveness check
   ▼
Supabase Postgres (RLS on every table) + Supabase Auth
```

One unified `Opportunity` model and one pipeline serve all four types; a type is just a field plus its own search queries.

## Data flow

1. **Search** (`src/lib/discovery/queries.ts`, `sites.ts`): up to 6 site-targeted queries (`site:` operators) per run. Per wanted type, the first query targets one rotating "anchor" site and the second a group of three others, drawn from a per-type `SOURCES` list (Internshala, Unstop, LinkedIn, Wellfound, Foundit, company careers; Devfolio, Devpost, Hack2skill, HackerEarth, Kaggle, MLH; Buddy4Study, Scholars4Dev, foundations, Vidyasaarathi, National Scholarship Portal; and more). The platform rotation changes every run. Searches use TinyFish Search with a recency filter.
2. **Pick pages** (`urlClassifier.ts`, `run.ts`): only URLs that look like **one listing** are fetched (per-site path patterns: Internshala `/internship/detail/`, Unstop `/hackathons/<slug>-<id>`, Devfolio/Devpost sub-domains, Buddy4Study `/page/`, LinkedIn `/jobs/view/<id>`, Wellfound `/jobs/<id>-…`). Category, search, article, PDF, `api.` and bare-IP URLs are rejected before any fetch. At most 10 pages per run and 3 per site; pages saved in the last 7 days are skipped, and records older than 7 days are re-fetched first. If a type only returned index pages, up to 3 listing links are read from an index page's own HTML (TinyFish Fetch strips link targets, so this one step is a plain GET) and counted towards the cap.
3. **Fetch** (`tinyfish.ts`): TinyFish Fetch returns the page text and the final URL after redirects (stored as `sourceUrl`).
4. **Skip, never bypass** (`extract.ts`): login walls, captchas, empty pages, 404s, cookie walls and non-listing pages are skipped and logged (`skipped: blocked`). No login, captcha or bot protection is ever circumvented and no credentials are stored.
5. **Extract only what the page says** (`extract.ts`): Gemini reads the page text and returns candidate fields; **every value is then checked against the page text and dropped if it does not appear there**. Missing fields are `null`. Deadlines are parsed from the date text on the page, never guessed.
6. **Liveness** (`liveness.ts`): HEAD, then GET, 5 s timeout. 404/410 sets `dead_link` and the row is hidden; the HTTP status is stored.
7. **Save as you go** (`jobs.ts`, `store.ts`): `POST /api/discover` returns a `jobId` immediately; the search runs in the background (`after()`), each row is upserted the moment it is extracted (one row per page, keyed by the normalised URL) and scored right away. The Matches page polls the job every 2 s and shows cards as they appear. A run stops starting new work after 60 s. One running job per user.
8. **Rule gate** (`src/lib/matching/ruleGate.ts`, pure): drops opportunities of an unwanted type, with a passed deadline, or a non-matching location (internships and jobs only). Degree, branch, graduation batch and "final year" are enforced only when the listing states them clearly.
9. **Gemini matching** (`gemini.ts`): survivors are scored in JSON mode, four opportunities per call (three calls in parallel, 15 s timeout, one retry); output is Zod-validated per item, quotes that are not verbatim in the listing are removed, and `sourceUrl`/`fetchedAt` come from our data. A rule-based fallback is **shown but never saved**.
10. **Applications** (`src/lib/applications`, `src/lib/scoring/priority.ts`): saved items carry a status, a computed urgency (red under 3 days, amber 3-7, green over 7, grey passed) and `priority = fit score × urgency multiplier`, passed deadlines last.

## What the UI shows for every opportunity

A source badge (site name and favicon, plain hostname, "Fetched <date and time>"), and a primary button **Apply / View on <Site> ↗** that opens `applyUrl ?? sourceUrl` in a new tab. Expanded evidence quotes say "from <Site>" with a link to the same page. The Matches page has a source filter built from the sources actually present. Expired listings show "Closed", dead links are hidden.

## Folder ownership

| Owner | Area | Paths |
| --- | --- | --- |
| **Dev A** Backend / Data / Auth | DB, auth, profile + applications API, shared types and schemas | `supabase/`, `src/proxy.ts`, `src/lib/routing.ts`, `src/app/(auth)`, `src/app/auth`, `src/app/api/{profile,applications,health}`, `src/lib/{supabase,auth,validation,applications}`, `src/lib/api.ts`, `src/types` |
| **Dev B** Discovery | search, fetch, extraction, jobs, real-data scripts | `src/lib/discovery`, `src/app/api/{discover,opportunities}`, `scripts/` |
| **Dev C** Match engine | Rule gate, Gemini, priority scoring | `src/lib/matching`, `src/lib/scoring`, `src/app/api/match` |
| **Dev D** Frontend / Demo | Pages, components, hooks | `src/app/page.tsx`, `src/app/(app)`, `src/components`, `src/hooks`, `docs/` |

Changes to `src/types/index.ts` affect everyone: open a PR and tag the other devs.

## Setup

Requires Node 20+ and npm.

1. **Create a Supabase project** at <https://supabase.com/dashboard>.
2. **Run the migrations** in the SQL Editor, in order: `supabase/migrations/0001_init.sql`, `0002_opportunity_flag.sql`, `0003_indexes.sql`, `0004_real_data_jobs.sql`. Then run `npm run clean-urls` once to delete any fake or example rows from older versions.
3. **Auth settings** (*Authentication → Providers → Email*): turn **off** "Confirm email" for the demo so signup logs the user in immediately.
4. **Password policy** (*Authentication → Policies / Password*): set **minimum password length to 8**. The sign-up form enforces 8 characters in the browser, but only this setting enforces it on the server (Supabase's default is 6).
5. **Environment:** copy `.env.example` to `.env.local` and fill it in (Supabase URL and keys, `TINYFISH_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SITE_URL`). Never commit `.env.local`.
6. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   Open <http://localhost:3000>.

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm test` | Vitest unit tests |
| `npm run collect` | Real discovery for the demo profile, up to 5 runs, prints a table (title, org, type, site, URL, deadline, HTTP status). `-- --dry` writes nothing, `-- --runs N` |
| `npm run prescore` | Score the demo user's cached real opportunities with Gemini and store real AI matches (`-- --force` re-scores) |
| `npm run demo:prepare` | `collect` then `prescore` then a readiness report. Run this before a demo |
| `npm run clean-urls` | List then delete rows whose source URL is fake or unusable (`-- --dry` lists only) |

### Environment variables

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client config |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Writes to `opportunities` and `discovery_jobs`; never reaches the client bundle |
| `TINYFISH_API_KEY` (+ optional `TINYFISH_SEARCH_URL`, `TINYFISH_FETCH_URL`) | Search and Fetch |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Extraction and matching (default model `gemini-3.1-flash-lite`) |
| `NEXT_PUBLIC_SITE_URL` | Site URL used for auth redirects |
| `DEMO_MODE=true` | **Zero external calls except Supabase.** Discovery serves saved real rows; `/api/match` serves stored AI matches plus instant, clearly labelled, never-saved rule-based cards for anything unscored |
| `MATCH_CACHE_ONLY=true` | `/api/match` serves stored AI matches only |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | The demo account (defaults `demo@opportunityos.dev` / `demo-password-123`) |
| `DEMO_PRESCORE_ON_START=true` | Opt-in: in DEMO_MODE, if the demo user has no AI matches, pre-score them in the background at startup. This is the only DEMO_MODE path that calls Gemini, so it is off by default |

## Demo mode

There is no hand-written or mock data anywhere. For a demo, run **`npm run demo:prepare`** once with internet: it collects real listings (each stored with its real `sourceUrl`, `sourceSite`, `fetchedAt`, `origin = 'live_fetch'`), scores them with Gemini and prints a readiness report. Then set `DEMO_MODE=true`: the whole flow runs from that snapshot with no calls to TinyFish or Gemini. A brand-new account gets instant labelled rule-based cards (never saved), so it is never empty. Details in [DEPLOY.md](DEPLOY.md) and [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Reliability and security

- Search: 15 s timeout, one retry. Fetch: 45 s timeout, one retry. Gemini: 15 s timeout, one retry (a timeout is not retried during extraction). Each page has a 45 s budget and a run stops starting new pages after 60 s. One failing URL never fails a run. If every search fails the job reports "Live search unavailable, showing saved results" instead of silently returning nothing.
- Every `/api` route except `/api/health` requires a session (proxy plus `requireUser`). Bodies are validated with Zod. Errors are `{ error: { message } }`.
- Row Level Security is on `profiles`, `matches`, `applications`, `discovery_jobs` and `opportunities` (readable by signed-in users, writable only with the service role). Verified with a second user.
- Server keys stay server-side (checked by grepping the client bundle). Logs contain counts, not page content or keys.
- Source URLs: example.com, localhost, `*.test`, bare IPs, empty and non-http(s) URLs are rejected in code and by a database constraint.

## Known limitations

- **Live discovery depends on third parties.** TinyFish cannot fetch some sites (Foundit, Indeed, Glassdoor and Kaggle were unreachable in testing) and some pages are empty to it (Naukri, the National Scholarship Portal); those are skipped, not worked around. LinkedIn public job pages did load; login walls and captchas are skipped if they appear.
- **Yield varies.** A run fetches at most 10 pages and typically saves 4-9 listings; several runs are needed for a large snapshot. Many hackathon pages stay online after their deadline and are shown as "Closed".
- **Extraction is validated against the fetched page text,** not against the live page a second time. Fields the page does not state are left empty, so some cards have no deadline or eligibility text.
- **The rule gate is heuristic** (regex over eligibility text) and deliberately conservative. Deadlines need a full date on the page; dates are treated as UTC days.
- **Index-page expansion uses a plain GET** because TinyFish Fetch drops link targets; JavaScript-only index pages yield no links.
- **Reminders are in-app only.** No email or push. Google sign-in is a TODO (`src/app/auth/callback/route.ts`).
- **UI gaps:** no drag-and-drop on the board; optional CGPA and availability date cannot be cleared once saved.
- **Tooling:** TypeScript is pinned to 6.x because `typescript-eslint` does not yet support 7.
- Supabase is required even in demo mode.

## Branching rule

Work on feature branches (`feat/<area>-<thing>`, e.g. `feat/discovery-normalize`) and open a pull request. **Never push directly to `main`.**
