-- Bug: deleting a comment that has replies triggers the ON DELETE SET NULL
-- cascade on those replies' parent_comment_id (migration 16's fix so
-- deleting a comment doesn't destroy others' replies to it) - which is
-- itself an UPDATE on the comments table, and migration 17's immutability
-- guard was blocking ANY change to parent_comment_id, including that
-- legitimate system-driven orphaning. That made deleting a commented-on
-- comment fail outright with "only a comment's content can be edited".
--
-- Fix: only block retargeting a reply from one specific parent to another
-- (or attaching a parent to a previously top-level comment) - both of
-- which are the actual integrity concern - while still allowing
-- parent_comment_id to become null, which is exactly what orphaning does.
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
       or new.author_id is distinct from old.author_id then
      raise exception 'only a comment''s content can be edited';
    end if;

    if new.parent_comment_id is not null and new.parent_comment_id is distinct from old.parent_comment_id then
      raise exception 'a comment''s parent cannot be changed';
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
