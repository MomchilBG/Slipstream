-- Three fixes from a code review of the notifications feature (migration 33):
--
-- 1. The @mention scan had no boundary check before "@", so it matched
--    mid-string inside things like an email address ("bob@example.com"
--    would "mention" a user named "example"). Both this trigger and
--    MentionText.tsx's copy of the pattern now require the "@" not be
--    glued onto a preceding email/URL-ish character, via a negative
--    lookbehind (Postgres's regex engine does support lookbehind).
--
-- 2. A reply to a reply always resolved its reply_to_comment notification
--    to the top-level comment's author, never the actual reply being
--    replied to - since every reply attaches flatly under parent_comment_id
--    (see PostView.tsx's startReply()), the trigger had no way to tell
--    those two cases apart. The real target was only reachable via the
--    client's editable "@username " prefill, so clearing that prefix
--    silently dropped the notification entirely. comments.reply_target_id
--    is a new, separate column carrying the actual reply target (which the
--    client already tracks locally as replyingToCommentId) so the trigger
--    can notify the right person regardless of what the content ends up
--    saying.
--
-- 3. The notifications UPDATE policy let a recipient rewrite any column of
--    their own row, not just is_read - out of step with the immutability
--    guards the rest of this schema uses for exactly this kind of
--    tampering (enforce_profile_restrictions, enforce_post_restrictions).

alter table public.comments add column reply_target_id uuid references public.comments(id) on delete set null;
create index comments_reply_target_id_idx on public.comments (reply_target_id);

create or replace function public.enforce_comment_parent_same_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post_id uuid;
  reply_target_post_id uuid;
begin
  if new.parent_comment_id is not null then
    select post_id into parent_post_id from public.comments where id = new.parent_comment_id;
    if parent_post_id is distinct from new.post_id then
      raise exception 'a reply must belong to the same post as its parent comment';
    end if;
  end if;

  if new.reply_target_id is not null then
    select post_id into reply_target_post_id from public.comments where id = new.reply_target_id;
    if reply_target_post_id is distinct from new.post_id then
      raise exception 'a reply target must belong to the same post as the reply';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_comment_parent_same_post() from public, anon, authenticated;

create or replace function public.notify_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  reply_target_author uuid;
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
    -- reply_target_id is the comment actually being replied to, which may
    -- itself be a reply rather than the flat top-level parent_comment_id
    -- every reply attaches under - falls back to parent_comment_id for a
    -- reply directly to a top-level comment, where the two are the same row.
    select author_id into reply_target_author
    from public.comments
    where id = coalesce(new.reply_target_id, new.parent_comment_id);

    if reply_target_author is not null and reply_target_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (reply_target_author, new.author_id, 'reply_to_comment', new.post_id, new.id);
      already_notified := array_append(already_notified, reply_target_author);
    end if;
  end if;

  for mentioned_username in
    select distinct lower(m[1])
    from regexp_matches(new.content, '(?<![A-Za-z0-9_.+-])@([A-Za-z0-9_]{3,32})', 'g') as m
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

revoke execute on function public.notify_on_comment_insert() from public, anon, authenticated;

create function public.enforce_notification_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.actor_id is distinct from old.actor_id
     or new.type is distinct from old.type
     or new.post_id is distinct from old.post_id
     or new.comment_id is distinct from old.comment_id
     or new.created_at is distinct from old.created_at then
    raise exception 'only is_read can be changed on a notification';
  end if;
  return new;
end;
$$;

create trigger trg_notification_restrictions
before update on public.notifications
for each row execute function public.enforce_notification_restrictions();

revoke execute on function public.enforce_notification_restrictions() from public, anon, authenticated;
