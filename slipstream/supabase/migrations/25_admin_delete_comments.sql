-- Admins can delete any comment for moderation, mirroring the equivalent
-- "Non-blocked authors and admins can delete posts" policy from migration 21.
drop policy "Non-blocked authors can delete own comments" on public.comments;
create policy "Non-blocked authors and admins can delete comments"
on public.comments for delete
using (((select auth.uid()) = author_id and not public.is_blocked()) or public.is_admin());
