-- ============================================================================
-- Migration 0007: two more themes
--
-- profiles.theme_preference's check constraint has to list every valid
-- value explicitly (0006), so adding a theme in theme.ts means adding it
-- here too, or a client trying to save 'comic'/'cozy' gets rejected at the
-- database with no clearer error than "violates check constraint".
-- ============================================================================

alter table public.profiles
  drop constraint profiles_theme_preference_check,
  add constraint profiles_theme_preference_check
    check (theme_preference in ('system', 'light', 'dark', 'midnight', 'sepia', 'comic', 'cozy'));
