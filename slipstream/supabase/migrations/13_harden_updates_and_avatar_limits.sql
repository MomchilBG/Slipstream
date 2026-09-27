-- 1. Blocked users could still UPDATE their existing posts/comments/votes
-- (only INSERT was gated on is_blocked()). Close that off.
drop policy "Authors can update own posts" on public.posts;
create policy "Non-blocked authors can update own posts"
on public.posts for update
using ((select auth.uid()) = author_id and not public.is_blocked())
with check ((select auth.uid()) = author_id and not public.is_blocked());

drop policy "Authors can update own comments" on public.comments;
create policy "Non-blocked authors can update own comments"
on public.comments for update
using ((select auth.uid()) = author_id and not public.is_blocked())
with check ((select auth.uid()) = author_id and not public.is_blocked());

drop policy "Users can change own vote" on public.votes;
create policy "Non-blocked users can change own vote"
on public.votes for update
using ((select auth.uid()) = voter_id and not public.is_blocked())
with check ((select auth.uid()) = voter_id and not public.is_blocked());

-- 2. enforce_vote_rules() only ran BEFORE INSERT, so a user could PATCH
-- their own vote's post_id/comment_id to retarget it (bypassing the
-- self-vote check, and leaving the original target's counters stale since
-- handle_vote_change's UPDATE branch only ever adjusts the OLD target).
-- A vote's target should never change after it's cast - only its value
-- (switching up<->down) does - so forbid retargeting outright.
create or replace function public.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author uuid;
begin
  if TG_OP = 'UPDATE' then
    if new.post_id is distinct from old.post_id or new.comment_id is distinct from old.comment_id then
      raise exception 'a vote''s target cannot be changed once cast';
    end if;
    return new;
  end if;

  if new.post_id is not null then
    select author_id into target_author from public.posts where id = new.post_id;
  else
    select author_id into target_author from public.comments where id = new.comment_id;
  end if;

  if target_author = new.voter_id then
    raise exception 'you cannot vote on your own post or comment';
  end if;

  return new;
end;
$$;

drop trigger trg_enforce_vote_rules on public.votes;
create trigger trg_enforce_vote_rules
before insert or update on public.votes
for each row execute function public.enforce_vote_rules();

-- 3. Nothing stopped a user from changing their own profiles.email, which
-- would silently desync it from auth.users.email and break
-- email_for_username()-based login by username.
create or replace function public.enforce_profile_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'username cannot be changed once set';
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'only admins can change role';
    end if;
    if new.is_blocked is distinct from old.is_blocked then
      raise exception 'only admins can change blocked status';
    end if;
    if new.email is distinct from old.email then
      raise exception 'email cannot be changed here; it must stay in sync with your login email';
    end if;
  end if;

  if new.reputation is distinct from old.reputation
     and coalesce(current_setting('app.bypass_reputation_guard', true), 'false') <> 'true' then
    raise exception 'reputation cannot be changed directly';
  end if;

  return new;
end;
$$;

-- 4. The avatars bucket had no server-side size/type limit, so the 2MB
-- image-only check in the client's upload helper was only a suggestion -
-- anyone calling the storage API directly could upload anything.
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';
