-- FloodWatch Manouba: shared citizen reports.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all > Run.

create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type       text not null check (type  in ('t1','t2','t3','t4')),
  depth      text not null check (depth in ('d0','d1','d2','d3')),
  note       text not null default '' check (char_length(note) <= 300),
  lat        double precision not null check (lat between 36.50 and 37.00),   -- Manouba and surroundings only
  lon        double precision not null check (lon between 9.50 and 10.20)
);

-- Row level security: the public (anon key) may ADD a report, nothing else.
-- It cannot read, change or delete rows of this table. You read everything in the dashboard (Table Editor).
alter table public.reports enable row level security;
drop policy if exists "anyone can add a report" on public.reports;
create policy "anyone can add a report" on public.reports for insert to anon with check (true);
grant insert on public.reports to anon;

-- What the website reads: last 72 hours, place rounded to about 110 m, no free-text note.
create or replace view public.reports_public as
  select id, type, depth,
         round(lat::numeric, 3)::float8 as lat,
         round(lon::numeric, 3)::float8 as lon,
         created_at
  from public.reports
  where created_at > now() - interval '72 hours';
grant select on public.reports_public to anon;

-- Flood protection: at most 30 new reports per minute in total (stops a script from filling the table).
create or replace function public.reports_throttle() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.reports where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many reports, try again later';
  end if;
  return new;
end $$;
drop trigger if exists reports_throttle_t on public.reports;
create trigger reports_throttle_t before insert on public.reports for each row execute function public.reports_throttle();
