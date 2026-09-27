-- Migration 06 revoked EXECUTE from the PUBLIC pseudo-role, but Supabase
-- grants EXECUTE to anon/authenticated explicitly by default at creation
-- time, which is a separate grant unaffected by "REVOKE ... FROM PUBLIC".
-- Revoke from those roles directly to actually lock the functions down.
revoke execute on function public.apply_vote_effects(uuid, uuid, integer, integer) from anon, authenticated;
revoke execute on function public.check_and_award_badges(uuid) from anon, authenticated;
revoke execute on function public.enforce_post_restrictions() from anon, authenticated;
revoke execute on function public.enforce_profile_restrictions() from anon, authenticated;
revoke execute on function public.enforce_vote_rules() from anon, authenticated;
revoke execute on function public.handle_comment_delete() from anon, authenticated;
revoke execute on function public.handle_comment_insert() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_vote_change() from anon, authenticated;
revoke execute on function public.trg_check_badges_on_comment() from anon, authenticated;
revoke execute on function public.trg_check_badges_on_post() from anon, authenticated;
