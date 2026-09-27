-- The app is about to let authors edit their own posts/comments (title,
-- content, tags) for the first time. Nothing previously stopped an owner
-- from also PATCHing structural identity fields via a raw API call - close
-- that off, mirroring the immutability guards already in place for votes
-- and profiles.username.

create or replace function public.enforce_post_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.like_count is distinct from old.like_count
      or new.dislike_count is distinct from old.dislike_count
      or new.comment_count is distinct from old.comment_count)
     and coalesce(current_setting('app.bypass_post_counters', true), 'false') <> 'true' then
    raise exception 'like_count, dislike_count and comment_count cannot be changed directly';
  end if;

  if new.author_id is distinct from old.author_id then
    raise exception 'a post''s author cannot be changed';
  end if;

  return new;
end;
$$;

-- Comments: only content may change once created - post_id, author_id and
-- parent_comment_id are all fixed at creation time.
create or replace function public.enforce_comment_parent_same_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post_id uuid;
  parent_parent_id uuid;
begin
  if TG_OP = 'UPDATE' then
    if new.post_id is distinct from old.post_id
       or new.author_id is distinct from old.author_id
       or new.parent_comment_id is distinct from old.parent_comment_id then
      raise exception 'only a comment''s content can be edited';
    end if;
    return new;
  end if;

  if new.parent_comment_id is not null then
    select post_id, parent_comment_id into parent_post_id, parent_parent_id
      from public.comments where id = new.parent_comment_id;

    if parent_post_id is distinct from new.post_id then
      raise exception 'a reply must belong to the same post as its parent comment';
    end if;

    if parent_parent_id is not null then
      raise exception 'replies can only be added to top-level comments';
    end if;
  end if;

  return new;
end;
$$;
