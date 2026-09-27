-- Follow-ups from this session's code review of migration 26's switch to
-- soft-deleting comments.

-- 1. deleteComment() only ever issues an UPDATE now (see migration 26), so
-- the "Non-blocked authors and admins can delete comments" DELETE policy
-- from migration 25 is dead from the app's point of view - but still live at
-- the RLS layer, meaning a raw REST/console call can still hard-delete a
-- comment, bypassing the soft-delete behavior (and silently reversing
-- reputation/orphaning replies via the ON DELETE SET NULL cascade) entirely.
-- Nothing in the app needs comments DELETE anymore: a post's own cascade
-- delete of its comments happens through the posts->comments foreign key,
-- which isn't subject to the referencing table's RLS policies.
drop policy "Non-blocked authors and admins can delete comments" on public.comments;

-- 2. A hard DELETE used to cascade-remove a comment's votes, which fired
-- handle_vote_change()'s DELETE branch and rolled back the reputation it had
-- given the author. A soft delete leaves the votes (and so the reputation)
-- in place with no equivalent - so do the same cleanup explicitly: once a
-- comment flips to is_deleted, delete its votes, which still fires the
-- existing votes trigger and reverses reputation exactly as before.
create function public.reverse_votes_on_comment_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.votes where comment_id = new.id;
  return new;
end;
$$;

create trigger trg_comments_soft_delete_reverse_votes
after update on public.comments
for each row
when (new.is_deleted and not old.is_deleted)
execute function public.reverse_votes_on_comment_soft_delete();

-- 3. check_and_award_badges()'s comment_count no longer drops when a comment
-- is removed (it's a soft delete, so the row - and un-filtered count(*) -
-- stays), so exclude is_deleted comments to keep the count matching what the
-- user actually has visible, same as a hard delete used to.
create or replace function public.check_and_award_badges(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post_count integer;
  comment_count integer;
  user_reputation integer;
  tenure_days integer;
begin
  if target_user is null then
    return;
  end if;

  select count(*) into post_count from public.posts where author_id = target_user;
  select count(*) into comment_count from public.comments where author_id = target_user and not is_deleted;
  select p.reputation, extract(day from now() - p.created_at)::integer
    into user_reputation, tenure_days
    from public.profiles p where p.id = target_user;

  insert into public.user_badges (user_id, badge_id)
  select target_user, b.id
  from public.badges b
  where (
    (b.criteria_type = 'post_count' and post_count >= b.threshold) or
    (b.criteria_type = 'comment_count' and comment_count >= b.threshold) or
    (b.criteria_type = 'reputation' and user_reputation >= b.threshold) or
    (b.criteria_type = 'tenure_days' and tenure_days >= b.threshold)
  )
  on conflict (user_id, badge_id) do nothing;
end;
$$;
