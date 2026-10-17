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
