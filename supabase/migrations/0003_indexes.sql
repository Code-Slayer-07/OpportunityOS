-- Read performance for the cached-results path.
create index if not exists opportunities_type_deadline_idx on public.opportunities (type, deadline);
create index if not exists matches_user_score_idx on public.matches (user_id, score desc);
create index if not exists applications_user_idx on public.applications (user_id);
