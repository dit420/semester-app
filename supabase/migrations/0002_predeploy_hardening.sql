-- ============================================================================
-- Migration 0002: pre-deploy hardening
--
-- Three gaps found in a pre-deploy security review, in order of severity:
--
-- 1. profiles_update_self (0001) lets a signed-in user update ANY column on
--    their own profile row, including group_code. Every group-scoped policy
--    (assignments_read, confirmations_read, my_group()) trusts group_code, so
--    without this a user could set their own group_code to the other group's
--    and read that group's assignment list. This trigger rejects any client
--    attempt to change group_code. It can still be changed by hand via the
--    SQL editor -- that runs outside PostgREST's JWT context, so auth.role()
--    is null there, not 'authenticated' -- which is the only path that should
--    ever need to.
--
-- 2. Nothing capped how many assignments one account could insert. Capped at
--    20 per user per rolling 24h -- generous for real use, a hard stop for a
--    runaway client or someone testing the limits.
--
-- 3. Signup was open to anyone with the URL. Gated behind an invite code,
--    checked once at account creation. This trigger only fires on a genuine
--    INSERT into auth.users (a brand-new email) -- a returning user's sign-in
--    never re-inserts a row, so they're never asked again.
-- ============================================================================

-- ------------------------------------------------------- 1. lock group_code --
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
  return new;
end;
$$;

create trigger profiles_lock_group_code
  before update on public.profiles
  for each row execute function public.lock_group_code();

-- ------------------------------------------------- 2. assignment rate limit --
create or replace function public.enforce_assignment_rate_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.assignments
  where created_by = new.created_by
    and created_at > now() - interval '24 hours';

  if recent_count >= 20 then
    raise exception 'rate limit: at most 20 assignments per 24 hours';
  end if;

  return new;
end;
$$;

create trigger assignments_rate_limit
  before insert on public.assignments
  for each row execute function public.enforce_assignment_rate_limit();

-- ------------------------------------------------ 3. invite-gated signup --
-- The code lives in this function body, not in client code or an env var --
-- PostgREST's anon/authenticated roles never get raw SQL access, so it isn't
-- reachable from the browser. To rotate it, run this same
-- `create or replace function` with a new literal; no redeploy needed.
create or replace function public.enforce_invite_code()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'invite_code', '') <> 'NBMDHMKK' then
    raise exception 'invalid invite code';
  end if;
  return new;
end;
$$;

create trigger enforce_invite_code
  before insert on auth.users
  for each row execute function public.enforce_invite_code();
