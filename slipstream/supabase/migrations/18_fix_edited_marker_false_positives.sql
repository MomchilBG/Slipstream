-- posts/comments.updated_at was bumped by the generic set_updated_at()
-- trigger on ANY update - including vote-driven like_count/dislike_count
-- changes and (for posts) nothing comment-related touches posts directly,
-- but the same generic trigger would also fire for those. That made the
-- new "(edited)" UI indicator (comparing updated_at to created_at) show up
-- on posts/comments that were only ever voted on, never actually edited.
-- Give each table its own trigger that only bumps updated_at when the
-- content a user actually edits (title/content, or just content for
-- comments) changes.

create or replace function public.set_posts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.title is distinct from old.title or new.content is distinct from old.content then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_posts_updated_at();

create or replace function public.set_comments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.content is distinct from old.content then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.set_comments_updated_at();

-- One-time cleanup: the post/comment editing feature didn't exist before
-- this migration, so any existing updated_at <> created_at discrepancy can
-- only be a false positive from the bug above, not a real edit. Disable
-- the (new) triggers first - otherwise their own "no real change, keep the
-- old updated_at" branch would immediately undo this reset.
alter table public.posts disable trigger trg_posts_updated_at;
update public.posts set updated_at = created_at where updated_at <> created_at;
alter table public.posts enable trigger trg_posts_updated_at;

alter table public.comments disable trigger trg_comments_updated_at;
update public.comments set updated_at = created_at where updated_at <> created_at;
alter table public.comments enable trigger trg_comments_updated_at;
