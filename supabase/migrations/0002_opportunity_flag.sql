-- Discovery: keep records that are incomplete/expired instead of dropping them.
alter table public.opportunities
  add column flag text check (flag in ('expired', 'incomplete'));
