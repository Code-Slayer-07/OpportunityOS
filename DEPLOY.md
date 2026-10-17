# Deploying OpportunityOS (Vercel + Supabase)

About 20 minutes. You need a GitHub repo with this code, a Supabase project, a Vercel account, and the TinyFish and Gemini API keys.

## 0. Before you start

```bash
npm install
npm run lint && npm run build && npm test   # all three must pass
```

Never commit `.env.local`. If any key was ever pasted into a chat, ticket or screenshot, rotate it before the public demo (Supabase: Project Settings → API; TinyFish and Gemini: their dashboards).

## 1. Supabase: database

1. Create the project (or reuse yours). Note the **Project URL**, **anon key** and **service_role key** from *Project Settings → API*.
2. Open *SQL Editor* and run these files **in order**, each as a new query:
   1. `supabase/migrations/0001_init.sql`: tables, RLS, signup trigger
   2. `supabase/migrations/0002_opportunity_flag.sql`: `opportunities.flag`
   3. `supabase/migrations/0003_indexes.sql`: read indexes
3. Check *Table Editor*: `profiles`, `opportunities`, `matches`, `applications` exist and each shows "RLS enabled".

## 2. Supabase: authentication

*Authentication → Providers → Email*

- **Confirm email: OFF for the demo.** With it ON, signup creates the account but gives no session until the user clicks an email link, so "sign up → land on /profile" breaks. Turn it back ON for a real launch.

*Authentication → URL Configuration* (do this **after** you know the Vercel URL, step 3)

- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** add `https://<your-app>.vercel.app/**` and `http://localhost:3000/**`

Password login works without these, but `/auth/callback` (used for the future Google sign-in and email links) needs them.

## 3. Vercel

1. *Add New → Project*, import the GitHub repo. Framework is detected as Next.js; keep the defaults (build `npm run build`, Node 20+).
2. Before the first deploy, add **Environment Variables** (Production; also Preview if you want PR previews):

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | public (safe by design, protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **secret**, server only |
| `TINYFISH_API_KEY` | your key | **secret** |
| `GEMINI_API_KEY` | your key | **secret** |
| `GEMINI_MODEL` | optional | default `gemini-3.1-flash-lite` |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | |
| `DEMO_MODE` | `true` | `/api/discover` serves cache/seed, no live web calls |
| `MATCH_CACHE_ONLY` | optional `true` | stored matches only, no Gemini |

   `NEXT_PUBLIC_*` values are baked in at build time, so **redeploy** after changing them.
3. Click **Deploy**. Copy the production URL, then go back to step 2 and set the Supabase Site URL / Redirect URLs. Update `NEXT_PUBLIC_SITE_URL` if the URL changed and redeploy.

## 4. Pre-load the demo data (run against production)

The prefetch script talks to Supabase directly, so run it from your laptop with the **production** Supabase values in `.env.local` (it does not go through Vercel):

```bash
npm run prefetch -- --reseed
```

This creates the demo user (`demo@opportunityos.dev` / `demo-password-123`; set `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` first to use your own), loads 17 sample listings with fresh relative deadlines, scores them with Gemini (about 20 seconds) and prints a table. You want **at least 10 rows**.

- `--refresh` replaces/adds **real** listings by running live TinyFish discovery (a few minutes, uses credits). Do it the day before if you want real data on stage.
- Re-run `--reseed` on the morning of the demo: seeded deadlines are relative to the day you seed, and the urgency colours depend on them.
- The demo password is public knowledge once the URL is shared; pick your own.

## 5. Verify production

1. `https://<app>/api/health` returns `{"data":{"status":"ok",...}}`.
2. `https://<app>/` shows the landing page when logged out.
3. Log in as the demo user: you land on `/matches` (profile is complete). Matches are already listed.
4. Click **↻ Refresh** (shown as **Find opportunities** on a fresh account): finishes in a few seconds, 10+ cards.
5. Expand a card: reason, quoted evidence with a source link, gaps.
6. **Save** two cards, open **Action Plan**: urgency colours, top priorities, navbar badge.
7. Refresh the page: everything persists. Log out and back in: still there.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Signup says "check your email" | Email confirmation is still ON (step 2). |
| Redirected to `/login` in a loop | `NEXT_PUBLIC_SUPABASE_*` missing or wrong in Vercel; fix and redeploy. |
| `/api/*` returns 503 "Authentication service unavailable" | Supabase unreachable or wrong URL/keys. |
| Deploy fails with a function duration error | Your Vercel plan caps `maxDuration`. Lower `export const maxDuration` in `src/app/api/discover/route.ts` (300) and `.../match/route.ts` (120) to your plan's limit. In `DEMO_MODE` both finish in seconds. |
| "Find opportunities" shows few or no cards | Run `npm run prefetch -- --reseed`; check migrations 0001-0003 all ran. |
| Everything is red/"Closed" | Seeded deadlines have passed; run `--reseed`. |
| Live discovery times out in production | Expected on serverless: each page takes 30-100 s. Run `prefetch -- --refresh` locally instead and keep `DEMO_MODE=true`. |
