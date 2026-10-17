-- Real data only, one row per page, background discovery jobs, never-persisted fallback matches.
-- Run in the Supabase SQL editor after 0001-0003. Safe to re-run.

-- ------------------------------------------------------------------ opportunities: provenance
alter table public.opportunities
  add column if not exists source_site text,           -- "Internshala", "Unstop", ...
  add column if not exists origin text,                -- 'live_fetch': fetched from a real page by our own pipeline
  add column if not exists apply_url text,             -- direct apply link when the page exposes one
  add column if not exists http_status int,            -- status of the liveness check on source_url
  add column if not exists source_key text;            -- normalised source_url: lower-case host, no www, no tracking params, no trailing slash

alter table public.opportunities drop constraint if exists opportunities_origin_check;
alter table public.opportunities add constraint opportunities_origin_check check (origin is null or origin in ('live_fetch'));

-- 'dead_link' = the source page returned 404/410 (hidden everywhere)
alter table public.opportunities drop constraint if exists opportunities_flag_check;
alter table public.opportunities add constraint opportunities_flag_check check (flag is null or flag in ('expired', 'incomplete', 'dead_link'));

-- Backfill from the URL for rows that already exist.
update public.opportunities
set source_site = coalesce(source_site, initcap(split_part(regexp_replace(substring(source_url from '://([^/]+)'), '^(www\.|in\.|careers\.)', ''), '.', 1)))
where source_site is null;

update public.opportunities
set source_key = lower(regexp_replace(regexp_replace(regexp_replace(regexp_replace(source_url, '#.*$', ''), '[?&](utm_[^&]*|ref=[^&]*|source=[^&]*|fbclid=[^&]*|gclid=[^&]*)', '', 'g'), '^https?://(www\.)?', ''), '/+$', ''))
where source_key is null;

-- ------------------------------------------------------------------ merge duplicate pages
-- Keep the most complete row per page (eligibility text, evidence, deadline, reward), newest as tie-break.
delete from public.opportunities o
using (
  select id,
         row_number() over (
           partition by source_key
           order by (eligibility_text is not null)::int + coalesce(cardinality(evidence_snippets), 0) + (deadline is not null)::int + (reward is not null)::int desc,
                    fetched_at desc
         ) as rn
  from public.opportunities
) ranked
where o.id = ranked.id and ranked.rn > 1;

-- One row per page. Replaces the old (org, title, deadline) index, which created a second row whenever a
-- re-fetch extracted a different deadline.
drop index if exists public.opportunities_dedupe_idx;
create unique index if not exists opportunities_source_key_idx on public.opportunities (source_key);

-- No fake URLs from now on (NOT VALID: applies to new/updated rows; run scripts/clean-bad-urls.ts for old ones).
alter table public.opportunities drop constraint if exists opportunities_source_url_real;
alter table public.opportunities add constraint opportunities_source_url_real
  check (source_url ~* '^https?://' and source_url !~* '//([^/]*\.)?(example\.(com|org|net)|localhost|127\.0\.0\.1)([:/]|$)' and source_url !~* '\.test([:/]|$)') not valid;

-- ------------------------------------------------------------------ matches: never trust a fallback
alter table public.matches add column if not exists is_fallback boolean not null default false;

-- ------------------------------------------------------------------ background discovery jobs
create table if not exists public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'done', 'partial', 'failed')),
  stage text not null default 'searching' check (stage in ('searching', 'extracting', 'matching', 'done')),
  total int not null default 0,        -- pages to extract
  done int not null default 0,         -- pages processed so far
  found int not null default 0,        -- opportunities saved
  scored int not null default 0,       -- matches saved
  warning text,                        -- e.g. "Live search unavailable, showing saved results"
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

-- At most one running job per user.
create unique index if not exists discovery_jobs_one_running on public.discovery_jobs (user_id) where status = 'running';

alter table public.discovery_jobs enable row level security;
drop policy if exists "discovery_jobs_select_own" on public.discovery_jobs;
create policy "discovery_jobs_select_own" on public.discovery_jobs for select to authenticated using (auth.uid() = user_id);
-- Writes happen only with the service role (server), so there are no insert/update policies.
