create table public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  constraint votes_target_check check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

create unique index votes_voter_post_unique on public.votes (voter_id, post_id) where post_id is not null;
create unique index votes_voter_comment_unique on public.votes (voter_id, comment_id) where comment_id is not null;
create index votes_post_id_idx on public.votes (post_id);
create index votes_comment_id_idx on public.votes (comment_id);

create function public.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author uuid;
begin
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

create trigger trg_enforce_vote_rules
before insert on public.votes
for each row execute function public.enforce_vote_rules();

-- Applies a vote's effect on the target's like_count (posts only) and on the
-- content author's reputation. Wrapped by app.bypass_* local settings so the
-- integrity-guard triggers on posts/profiles allow these specific writes.
create function public.apply_vote_effects(target_post uuid, target_comment uuid, delta_reputation integer, delta_likes integer)
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
    update public.posts set like_count = like_count + delta_likes where id = target_post;
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

create function public.handle_vote_change()
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
      case when new.value = 1 then 1 else 0 end
    );
  elsif TG_OP = 'DELETE' then
    perform public.apply_vote_effects(
      old.post_id, old.comment_id,
      -old.value,
      case when old.value = 1 then -1 else 0 end
    );
  elsif TG_OP = 'UPDATE' then
    perform public.apply_vote_effects(
      old.post_id, old.comment_id,
      new.value - old.value,
      (case when new.value = 1 then 1 else 0 end) - (case when old.value = 1 then 1 else 0 end)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_vote_change
after insert or update or delete on public.votes
for each row execute function public.handle_vote_change();

alter table public.votes enable row level security;

create policy "Votes are viewable by everyone"
on public.votes for select
using (true);

create policy "Non-blocked users can vote"
on public.votes for insert
with check (auth.uid() = voter_id and not public.is_blocked());

create policy "Users can change own vote"
on public.votes for update
using (auth.uid() = voter_id)
with check (auth.uid() = voter_id);

create policy "Users can remove own vote"
on public.votes for delete
using (auth.uid() = voter_id);
