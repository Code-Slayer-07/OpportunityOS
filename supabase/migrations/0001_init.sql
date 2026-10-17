-- OpportunityOS initial schema. Owner: Dev A (Backend/Data/Auth).
-- Run in the Supabase SQL editor, or with `supabase db push`.

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  degree text,
  branch text,
  grad_year int,
  current_status text,
  cgpa numeric(4, 2),
  skills text[] not null default '{}',
  preferred_roles text[] not null default '{}',
  experience_level text,
  types text[] not null default '{}',
  locations text[] not null default '{}',
  open_to_remote boolean not null default false,
  availability_date date,
  github_url text,
  linkedin_url text,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, new.raw_user_meta_data ->> 'name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- opportunities
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('internship', 'job', 'hackathon', 'scholarship')),
  title text not null,
  org text not null,
  eligibility_text text,
  deadline timestamptz,
  location text,
  remote boolean not null default false,
  reward text,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  evidence_snippets text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- De-duplication. NULLS NOT DISTINCT so rolling listings (no deadline) dedupe too.
create unique index opportunities_dedupe_idx
  on public.opportunities (org, title, deadline) nulls not distinct;

alter table public.opportunities enable row level security;

-- Readable by any signed-in user; no write policies, so only the service role
-- (which bypasses RLS) can insert/update/delete.
create policy "opportunities_select_authenticated" on public.opportunities
  for select to authenticated using (true);

-- ---------------------------------------------------------------- matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  score int not null check (score between 0 and 100),
  reason text,
  evidence_map jsonb not null default '[]',
  gaps text[] not null default '{}',
  eligibility_uncertain boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

alter table public.matches enable row level security;

create policy "matches_own" on public.matches
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  status text not null default 'Saved'
    check (status in ('Saved', 'Applying', 'Applied', 'Interview', 'Result')),
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

create policy "applications_own" on public.applications
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
