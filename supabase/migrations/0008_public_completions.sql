-- ============================================================================
-- Migration 0008: make "done" visible to the group
--
-- This is a deliberate reversal of a documented design decision. 0001 and
-- docs/assignments.md are explicit: "done" was private, enforced by RLS
-- (assignment_completions only ever returned the caller's own rows) rather
-- than by UI convention, specifically so nobody could see that a classmate
-- hadn't started an assignment. That guarantee is being traded away here at
-- the user's explicit, informed request -- shown the tradeoff (every
-- student's completion state becomes visible to their whole group) and
-- asked again, they confirmed this is what they want.
--
-- completions_own (0001) was a single "for all" policy, so its USING clause
-- gated every operation including SELECT. Splitting it: read becomes
-- group-scoped (same shape as confirmations_read), write/update/delete stay
-- own-row-only -- you can mark yourself done, never fake someone else's.
-- ============================================================================

drop policy completions_own on public.assignment_completions;

create policy completions_read on public.assignment_completions for select
  using (exists (
    select 1 from public.assignments a
    where a.id = assignment_id
      and (a.group_code = public.my_group() or a.group_code = 'BOTH')
  ));

create policy completions_write_own on public.assignment_completions for insert
  with check (user_id = auth.uid());

create policy completions_update_own on public.assignment_completions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy completions_delete_own on public.assignment_completions for delete
  using (user_id = auth.uid());
