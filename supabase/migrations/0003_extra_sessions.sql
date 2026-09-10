-- ============================================================================
-- Migration 0003: ad-hoc ("abrupt") classes, admin-gated
--
-- A class the college adds outside the original timetable (a makeup, a
-- rescheduled session, a genuinely surprise one) still counts toward the
-- real 80% requirement if the college's own register counts it -- so it has
-- to enter the same pool the attendance maths reads from, not a separate
-- cosmetic-only list. Because adding one changes what "N more absences
-- allowed" means for the whole group, only an admin may do it. RLS enforces
-- this at the database -- a client-side-only check would be decorative,
-- since the anon key can call the insert directly and skip it entirely.
--
-- is_admin is locked the same way group_code was in 0002: no client-side
-- update can ever set it, only a direct SQL-editor session can, since that
-- runs outside PostgREST's JWT context (auth.role() is null there, not
-- 'authenticated').
--
-- To make yourself admin, run in the SQL editor:
--   update public.profiles set is_admin = true where id = '<your user id>';
-- (find your id via: select id, name from public.profiles;)
-- ============================================================================

alter table public.profiles
  add column is_admin boolean not null default false;

-- Extend the 0002 lock to cover is_admin too, same mechanism, same trigger --
-- profiles_lock_group_code already points at this function by name, so
-- redefining the body is enough; no need to touch the trigger itself.
create or replace function public.lock_group_code()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.group_code is distinct from old.group_code
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'group_code cannot be changed after signup';
  end if;
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_admin cannot be self-assigned';
  end if;
  return new;
end;
$$;

create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create table public.extra_sessions (
  id           uuid primary key default gen_random_uuid(),
  group_code   text not null check (group_code in ('A', 'B')),
  subject_code text not null,                    -- matches SUBS[].code, e.g. 'PHI-I'
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  room         text,
  faculty      text,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),

  -- Soft delete, same reasoning as assignments: retraction is recoverable
  -- and attributable, never destructive.
  deleted_at   timestamptz,
  deleted_by   uuid references public.profiles(id)
);

create index extra_sessions_feed_idx
  on public.extra_sessions (group_code, date)
  where deleted_at is null;

alter table public.extra_sessions enable row level security;

-- everyone in the group can see an admin-added class
create policy extra_sessions_read on public.extra_sessions for select
  using (group_code = public.my_group());

-- only an admin can add one, and only as themselves
create policy extra_sessions_insert on public.extra_sessions for insert
  with check (created_by = auth.uid() and public.is_admin());

-- any admin (not just the original poster) may fix or retract one -- the
-- gate that matters here is admin status, not authorship, since the point
-- is keeping one shared calendar accurate rather than protecting against
-- an untrusted crowd the way assignments' author-only rule does.
create policy extra_sessions_update_admin on public.extra_sessions for update
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy -- same reasoning as assignments: retraction sets
-- deleted_at/deleted_by, never destroys.
