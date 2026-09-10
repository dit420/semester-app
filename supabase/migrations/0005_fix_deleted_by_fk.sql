-- ============================================================================
-- Migration 0005: fix deleted_by foreign keys
--
-- Bug found while cleaning up test data: assignments.deleted_by and
-- extra_sessions.deleted_by reference profiles(id) with the default ON
-- DELETE behaviour (RESTRICT/NO ACTION), not a cascade or set-null. That
-- means deleting a profile who has ever soft-deleted anything -- their own
-- assignment, or, for an admin, any extra_sessions row -- fails with a
-- foreign key violation, rather than the profile deletion succeeding and
-- the historical "who retracted this" record just going blank.
--
-- ON DELETE SET NULL is the right behaviour here: the retraction itself
-- (deleted_at) is still real and stays, only the attribution is lost, which
-- is exactly what should happen once the retracting account no longer
-- exists.
-- ============================================================================

alter table public.assignments
  drop constraint assignments_deleted_by_fkey,
  add constraint assignments_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;

alter table public.extra_sessions
  drop constraint extra_sessions_deleted_by_fkey,
  add constraint extra_sessions_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;
