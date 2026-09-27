-- Posts previously only tracked upvotes (like_count). To show a net score
-- with the upvote/downvote split available on hover, track downvotes too.
alter table public.posts add column dislike_count integer not null default 0;

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
  return new;
end;
$$;

-- apply_vote_effects gains a delta_dislikes parameter, which changes its
-- signature (and therefore its identity) - drop and recreate rather than
-- CREATE OR REPLACE, then re-apply the same PUBLIC/anon/authenticated
-- lockdown migrations 06+07 put on the old signature (see their comments:
-- this function must never be directly callable via PostgREST RPC).
drop function public.apply_vote_effects(uuid, uuid, integer, integer);

create function public.apply_vote_effects(target_post uuid, target_comment uuid, delta_reputation integer, delta_likes integer, delta_dislikes integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  content_author uuid;
begin
  if target_post is not null then
    perform set_config('app.bypass_post_counters', 'true', true);
    update public.posts
      set like_count = like_count + delta_likes,
          dislike_count = dislike_count + delta_dislikes
      where id = target_post;
    perform set_config('app.bypass_post_counters', 'false', true);

    select author_id into content_author from public.posts where id = target_post;
  else
    select author_id into content_author from public.comments where id = target_comment;
  end if;

  if content_author is not null and delta_reputation <> 0 then
    perform set_config('app.bypass_reputation_guard', 'true', true);
    update public.profiles set reputation = reputation + delta_reputation where id = content_author;
    perform set_config('app.bypass_reputation_guard', 'false', true);
  end if;

  perform public.check_and_award_badges(content_author);
end;
$$;

revoke execute on function public.apply_vote_effects(uuid, uuid, integer, integer, integer) from public, anon, authenticated;

create or replace function public.handle_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.apply_vote_effects(
      new.post_id, new.comment_id,
      new.value,
      case when new.value = 1 then 1 else 0 end,
      case when new.value = -1 then 1 else 0 end
    );
  elsif TG_OP = 'DELETE' then
    perform public.apply_vote_effects(
      old.post_id, old.comment_id,
      -old.value,
      case when old.value = 1 then -1 else 0 end,
      case when old.value = -1 then -1 else 0 end
    );
  elsif TG_OP = 'UPDATE' then
    perform public.apply_vote_effects(
      old.post_id, old.comment_id,
      new.value - old.value,
      (case when new.value = 1 then 1 else 0 end) - (case when old.value = 1 then 1 else 0 end),
      (case when new.value = -1 then 1 else 0 end) - (case when old.value = -1 then 1 else 0 end)
    );
  end if;

  return coalesce(new, old);
end;
$$;
