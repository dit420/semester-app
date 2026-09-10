-- ============================================================================
-- Migration 0004: fix the 0002/0003 privilege lock
--
-- Bug found while testing the "escape hatch" the 0002 comment promised:
-- `coalesce(auth.role(), '') <> 'service_role'` is true even when
-- auth.role() is null, because coalesce turns null into '', and '' is also
-- not 'service_role'. So the trigger blocked a direct SQL-editor session
-- too, not just PostgREST requests -- there was no working way to promote
-- an admin or fix a group_code by hand at all.
--
-- Correct signal for "this is a real end-user request through PostgREST,
-- not a direct/privileged DB session": auth.uid() is not null. A direct
-- SQL-editor or psql session has no JWT context, so auth.uid() is null
-- there and the check is skipped, exactly as originally intended.
-- ============================================================================

create or replace function public.lock_group_code()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.group_code is distinct from old.group_code
     and auth.uid() is not null then
    raise exception 'group_code cannot be changed after signup';
  end if;
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null then
    raise exception 'is_admin cannot be self-assigned';
  end if;
  return new;
end;
$$;
