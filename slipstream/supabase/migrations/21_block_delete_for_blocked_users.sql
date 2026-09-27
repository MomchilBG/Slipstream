-- Editing your own post/comment already requires not being blocked (the
-- UPDATE policies from migration 13), but deleting your own post/comment
-- had no such check - inconsistent with "blocked users cannot post or
-- comment" extending to modifying/removing their existing content too.
drop policy "Authors and admins can delete posts" on public.posts;
create policy "Non-blocked authors and admins can delete posts"
on public.posts for delete
using (((select auth.uid()) = author_id and not public.is_blocked()) or public.is_admin());

drop policy "Authors can delete own comments" on public.comments;
create policy "Non-blocked authors can delete own comments"
on public.comments for delete
using ((select auth.uid()) = author_id and not public.is_blocked());
