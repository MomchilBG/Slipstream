-- Notifies a user when someone: (1) leaves a top-level comment directly on
-- their post, (2) replies to their comment, or (3) @mentions their username
-- in a comment/reply. One row per (recipient, triggering comment) - a reply
-- that also @mentions the same person it's replying to (the common case,
-- since the reply composer prefills "@username ") only generates the
-- reply_to_comment notification, not a duplicate mention one.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('comment_on_post', 'reply_to_comment', 'mention')),
  post_id uuid not null references public.posts(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_idx on public.notifications (recipient_id, created_at desc);
create index notifications_post_id_idx on public.notifications (post_id);
create index notifications_comment_id_idx on public.notifications (comment_id);
create index notifications_actor_id_idx on public.notifications (actor_id);

-- SECURITY DEFINER so it can insert a notification for the recipient
-- regardless of the commenting user's own RLS grants - same pattern as
-- apply_vote_effects()/check_and_award_badges() writing to other users' rows.
create function public.notify_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  parent_author uuid;
  already_notified uuid[] := array[]::uuid[];
  mentioned_username text;
  mentioned_user uuid;
begin
  if new.parent_comment_id is null then
    select author_id into post_author from public.posts where id = new.post_id;
    if post_author is not null and post_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (post_author, new.author_id, 'comment_on_post', new.post_id, new.id);
      already_notified := array_append(already_notified, post_author);
    end if;
  else
    select author_id into parent_author from public.comments where id = new.parent_comment_id;
    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (parent_author, new.author_id, 'reply_to_comment', new.post_id, new.id);
      already_notified := array_append(already_notified, parent_author);
    end if;
  end if;

  -- Usernames are lowercase-only (see profiles.username's own check
  -- constraint), so match case-insensitively and normalize before lookup -
  -- lets "@AlexR" mention the user "alexr" the same as typing it lowercase.
  for mentioned_username in
    select distinct lower(m[1])
    from regexp_matches(new.content, '@([A-Za-z0-9_]{3,32})', 'g') as m
  loop
    select id into mentioned_user from public.profiles where username = mentioned_username;
    if mentioned_user is not null
       and mentioned_user <> new.author_id
       and not (mentioned_user = any(already_notified)) then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (mentioned_user, new.author_id, 'mention', new.post_id, new.id);
      already_notified := array_append(already_notified, mentioned_user);
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_notify_on_comment_insert
after insert on public.comments
for each row execute function public.notify_on_comment_insert();

revoke execute on function public.notify_on_comment_insert() from public, anon, authenticated;

alter table public.notifications enable row level security;

create policy "Recipients can view own notifications"
on public.notifications for select
using ((select auth.uid()) = recipient_id);

create policy "Recipients can mark own notifications read"
on public.notifications for update
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);
