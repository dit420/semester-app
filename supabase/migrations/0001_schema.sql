-- ============================================================================
-- Schema: shared assignments + private attendance
--
-- The organising principle mirrors what the app already does with the
-- timetable: reference data is SHARED, personal judgements are PRIVATE.
--
--   timetable   shared, read-only     |  attendance    private per user
--   assignment  shared, group-writable|  "I've done it" private per user
--
-- Keeping those apart is what stops one student's progress leaking into
-- another's view, and what lets the shared list stay a single canonical copy.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  group_code  text not null check (group_code in ('A', 'B')),
  created_at  timestamptz not null default now()
);

-- Reads the caller's group without tripping RLS on profiles itself.
-- SECURITY DEFINER is required here: without it, the profiles SELECT policy
-- would call this function, which would query profiles, which would evaluate
-- the policy again -- infinite recursion.
create or replace function public.my_group()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select group_code from public.profiles where id = auth.uid()
$$;

-- ------------------------------------------------------------- assignments --
create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  group_code   text not null check (group_code in ('A', 'B', 'BOTH')),
  subject_code text not null,                    -- matches SUBS[].code, e.g. 'PHI-I'
  title        text not null check (length(trim(title)) between 1 and 200),
  details      text check (length(details) <= 2000),
  due_date     date not null,
  due_time     time,                             -- null = "end of day"
  attachment   text,                             -- storage path, optional
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Soft delete. A hard DELETE on shared data is unrecoverable, and the whole
  -- risk of this feature is one person removing everyone's deadlines. Rows are
  -- never destroyed; they are hidden and attributed.
  deleted_at   timestamptz,
  deleted_by   uuid references public.profiles(id)
);

create index assignments_feed_idx
  on public.assignments (group_code, due_date)
  where deleted_at is null;

create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger assignments_touch
  before update on public.assignments
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------- corroboration signal --
-- Instead of moderation, let the class vouch for an entry. "9 classmates
-- confirmed" tells you a deadline is real without anyone needing the power to
-- delete someone else's post.
create table public.assignment_confirmations (
  assignment_id uuid references public.assignments on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (assignment_id, user_id)
);

-- ------------------------------------------------------- private: my state --
create table public.assignment_completions (
  assignment_id uuid references public.assignments on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  done_at       timestamptz not null default now(),
  primary key (assignment_id, user_id)
);

create table public.attendance_records (
  user_id    uuid references public.profiles(id) on delete cascade,
  session_id text not null,                      -- 'PHI-I-B-4', from timetable.js
  status     text not null check (status in ('present', 'absent', 'cancelled')),
  marked_at  timestamptz not null default now(),
  primary key (user_id, session_id)
);

-- ============================================================================
-- Row level security
--
-- These policies ARE the backend. Test them adversarially before there is real
-- data: sign in as a second account and actively try to read the first one's
-- attendance. RLS failures are silent -- a missing policy looks like an empty
-- result, not an error.
-- ============================================================================

alter table public.profiles                 enable row level security;
alter table public.assignments              enable row level security;
alter table public.assignment_confirmations enable row level security;
alter table public.assignment_completions   enable row level security;
alter table public.attendance_records       enable row level security;

-- profiles: see yourself and your own group (needed to attribute posts)
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or group_code = public.my_group());

create policy profiles_insert_self on public.profiles for insert
  with check (id = auth.uid());

create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- assignments: read anything addressed to your group
create policy assignments_read on public.assignments for select
  using (group_code = public.my_group() or group_code = 'BOTH');

-- anyone in the group may post, but only as themselves and only to their group
create policy assignments_insert on public.assignments for insert
  with check (
    created_by = auth.uid()
    and (group_code = public.my_group() or group_code = 'BOTH')
  );

-- only the author may edit or retract. Deliberately narrow: the alternative
-- (anyone edits anything) means a single mistake costs the whole class.
create policy assignments_update_own on public.assignments for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- NOTE: no DELETE policy exists on purpose. Retraction is
--   update assignments set deleted_at = now(), deleted_by = auth.uid()
-- which is recoverable and attributable.

create policy confirmations_read on public.assignment_confirmations for select
  using (exists (
    select 1 from public.assignments a
    where a.id = assignment_id
      and (a.group_code = public.my_group() or a.group_code = 'BOTH')
  ));

create policy confirmations_write_own on public.assignment_confirmations for insert
  with check (user_id = auth.uid());

create policy confirmations_delete_own on public.assignment_confirmations for delete
  using (user_id = auth.uid());

-- private tables: strictly your own rows, all operations
create policy completions_own on public.assignment_completions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy attendance_own on public.attendance_records for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- Optional: attachments (photos of a whiteboard, brief PDFs)
-- Costs more than it looks -- upload UI, size and MIME limits, and a bucket
-- that classmates can write to. Defer to a second pass if you want the core
-- list working first.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-files', 'assignment-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy attachments_read on storage.objects for select
  using (bucket_id = 'assignment-files' and auth.uid() is not null);

create policy attachments_upload on storage.objects for insert
  with check (
    bucket_id = 'assignment-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text  -- own folder only
  );

create policy attachments_delete_own on storage.objects for delete
  using (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Optional: restrict signup to the college domain.
-- Without this, anyone with the URL can join a group and post to it.
-- Replace the domain, or drop this trigger and use an invite code instead.
-- ============================================================================
-- create or replace function public.enforce_email_domain()
--   returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   if new.email not like '%@yourcollege.edu' then
--     raise exception 'Sign up with your college email address';
--   end if;
--   return new;
-- end $$;
--
-- create trigger enforce_domain before insert on auth.users
--   for each row execute function public.enforce_email_domain();
