-- ============================================================================
-- Migration 0006: theme preference, avatars, and group chat
--
-- Three additions, same trust model as everything else in this schema:
--
-- 1. theme_preference + avatar_path on profiles. Both self-editable, same
--    as name already was -- neither is locked by the 0002/0004 trigger,
--    which only guards group_code and is_admin (the two columns that can
--    escalate privilege or bypass group isolation).
--
-- 2. avatars bucket. Public read (a profile picture isn't sensitive and
--    every screen that shows one would otherwise need a signed-URL round
--    trip), write restricted to the caller's own folder.
--
-- 3. chat_messages: shared, group-scoped, like assignments. Unlike
--    assignments, an admin (not just the author) may retract a message --
--    chat is higher-volume and more ephemeral, and admin is already a real
--    role in this schema (0003), so this reuses it rather than inventing a
--    second moderation concept. Still soft-delete only, still no DELETE
--    policy, still rate-limited the same way assignments are.
--    chat-files bucket is private: read access is tied to the requester
--    being in the same group as the message the file is attached to, not
--    just "signed in."
-- ============================================================================

alter table public.profiles
  add column theme_preference text not null default 'system'
    check (theme_preference in ('system', 'light', 'dark', 'midnight', 'sepia')),
  add column avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_upload_own on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------------- chat --
create table public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  group_code       text not null check (group_code in ('A', 'B')),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  body             text check (length(body) <= 2000),
  attachment_path  text,
  attachment_name  text,
  attachment_size  int,
  created_at       timestamptz not null default now(),

  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles(id) on delete set null,

  check (body is not null or attachment_path is not null)
);

create index chat_messages_feed_idx
  on public.chat_messages (group_code, created_at)
  where deleted_at is null;

alter table public.chat_messages enable row level security;

create policy chat_messages_read on public.chat_messages for select
  using (group_code = public.my_group());

create policy chat_messages_insert on public.chat_messages for insert
  with check (user_id = auth.uid() and group_code = public.my_group());

-- Author or any admin may retract (soft-delete). Chat is higher-volume and
-- more ephemeral than assignments, so unlike assignments_update_own this
-- isn't author-only -- an admin can also pull down a message.
create policy chat_messages_retract on public.chat_messages for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- No DELETE policy -- same reasoning as assignments and extra_sessions:
-- retraction sets deleted_at/deleted_by, never destroys.

create or replace function public.enforce_chat_rate_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.chat_messages
  where user_id = new.user_id
    and created_at > now() - interval '10 minutes';

  if recent_count >= 60 then
    raise exception 'rate limit: at most 60 chat messages per 10 minutes';
  end if;

  return new;
end;
$$;

create trigger chat_messages_rate_limit
  before insert on public.chat_messages
  for each row execute function public.enforce_chat_rate_limit();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'application/zip'
])
on conflict (id) do nothing;

-- Read is gated on "is this file attached to a message in my group", not
-- just "signed in" -- otherwise anyone who guesses a path could read a
-- file meant for the other group.
create policy chat_files_read on storage.objects for select
  using (
    bucket_id = 'chat-files'
    and exists (
      select 1 from public.chat_messages m
      where m.attachment_path = storage.objects.name
        and m.group_code = public.my_group()
    )
  );

create policy chat_files_upload_own on storage.objects for insert
  with check (
    bucket_id = 'chat-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
