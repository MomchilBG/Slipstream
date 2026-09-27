-- 1. Missing search_path on set_updated_at (search-path hijacking hardening).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Internal-only SECURITY DEFINER functions must not be directly callable
-- via PostgREST RPC. apply_vote_effects in particular took explicit
-- delta_reputation/delta_likes args, so any signed-in user could call
-- /rest/v1/rpc/apply_vote_effects directly to inflate their own reputation
-- or a post's like_count, bypassing the real vote-driven logic entirely.
-- Revoke PUBLIC execute on every function only meant to be invoked from a
-- trigger or from another SECURITY DEFINER function; is_admin/is_blocked
-- stay executable since RLS policies (running as the querying role) call
-- them directly.
revoke execute on function public.apply_vote_effects(uuid, uuid, integer, integer) from public;
revoke execute on function public.check_and_award_badges(uuid) from public;
revoke execute on function public.enforce_post_restrictions() from public;
revoke execute on function public.enforce_profile_restrictions() from public;
revoke execute on function public.enforce_vote_rules() from public;
revoke execute on function public.handle_comment_delete() from public;
revoke execute on function public.handle_comment_insert() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_vote_change() from public;
revoke execute on function public.trg_check_badges_on_comment() from public;
revoke execute on function public.trg_check_badges_on_post() from public;

-- 3. Missing covering index on a foreign key.
create index user_badges_badge_id_idx on public.user_badges (badge_id);

-- 4. Wrap auth.*()/is_admin()/is_blocked() calls in `(select ...)` so
-- Postgres evaluates them once per statement instead of once per row, and
-- consolidate overlapping permissive policies flagged by the linter.
drop policy "Users can update own profile" on public.profiles;
drop policy "Admins can update any profile" on public.profiles;

create policy "Users and admins can update profiles"
on public.profiles for update
using ((select auth.uid()) = id or public.is_admin())
with check ((select auth.uid()) = id or public.is_admin());

drop policy "Non-blocked users can create own posts" on public.posts;
create policy "Non-blocked users can create own posts"
on public.posts for insert
with check ((select auth.uid()) = author_id and not public.is_blocked());

drop policy "Authors can update own posts" on public.posts;
create policy "Authors can update own posts"
on public.posts for update
using ((select auth.uid()) = author_id)
with check ((select auth.uid()) = author_id);

drop policy "Authors and admins can delete posts" on public.posts;
create policy "Authors and admins can delete posts"
on public.posts for delete
using ((select auth.uid()) = author_id or public.is_admin());

drop policy "Non-blocked users can comment" on public.comments;
create policy "Non-blocked users can comment"
on public.comments for insert
with check ((select auth.uid()) = author_id and not public.is_blocked());

drop policy "Authors can update own comments" on public.comments;
create policy "Authors can update own comments"
on public.comments for update
using ((select auth.uid()) = author_id)
with check ((select auth.uid()) = author_id);

drop policy "Authors can delete own comments" on public.comments;
create policy "Authors can delete own comments"
on public.comments for delete
using ((select auth.uid()) = author_id);

drop policy "Post owners and admins can tag posts" on public.post_tags;
create policy "Post owners and admins can tag posts"
on public.post_tags for insert
with check (
  public.is_admin()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
);

drop policy "Post owners and admins can untag posts" on public.post_tags;
create policy "Post owners and admins can untag posts"
on public.post_tags for delete
using (
  public.is_admin()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
);

drop policy "Non-blocked users can vote" on public.votes;
create policy "Non-blocked users can vote"
on public.votes for insert
with check ((select auth.uid()) = voter_id and not public.is_blocked());

drop policy "Users can change own vote" on public.votes;
create policy "Users can change own vote"
on public.votes for update
using ((select auth.uid()) = voter_id)
with check ((select auth.uid()) = voter_id);

drop policy "Users can remove own vote" on public.votes;
create policy "Users can remove own vote"
on public.votes for delete
using ((select auth.uid()) = voter_id);

-- badges: split the admin "for all" policy so it no longer overlaps with
-- the public select policy on the SELECT action.
drop policy "Admins can manage badges" on public.badges;

create policy "Admins can insert badges"
on public.badges for insert
with check (public.is_admin());

create policy "Admins can update badges"
on public.badges for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete badges"
on public.badges for delete
using (public.is_admin());
