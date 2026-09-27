create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  criteria_type text not null check (criteria_type in ('post_count', 'comment_count', 'reputation', 'tenure_days')),
  threshold integer not null check (threshold > 0),
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index user_badges_user_id_idx on public.user_badges (user_id);

insert into public.badges (code, name, description, criteria_type, threshold) values
  ('first_post', 'First Post', 'Created your first post', 'post_count', 1),
  ('prolific_poster', 'Prolific Poster', 'Created 10 posts', 'post_count', 10),
  ('first_comment', 'First Comment', 'Wrote your first comment', 'comment_count', 1),
  ('active_commenter', 'Active Commenter', 'Wrote 25 comments', 'comment_count', 25),
  ('rising_star', 'Rising Star', 'Reached 50 reputation', 'reputation', 50),
  ('trusted_voice', 'Trusted Voice', 'Reached 250 reputation', 'reputation', 250),
  ('veteran', 'Veteran', 'Member of the forum for 365 days', 'tenure_days', 365)
on conflict (code) do nothing;

-- Evaluates every badge's criteria for one user and awards any newly-earned
-- ones. SECURITY DEFINER so it can insert into user_badges regardless of the
-- calling user's RLS grants; called from triggers after posts/comments/votes.
create function public.check_and_award_badges(target_user uuid)
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
  select count(*) into comment_count from public.comments where author_id = target_user;
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

create function public.trg_check_badges_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_and_award_badges(new.author_id);
  return new;
end;
$$;

create trigger trg_posts_badge_check
after insert on public.posts
for each row execute function public.trg_check_badges_on_post();

create function public.trg_check_badges_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_and_award_badges(new.author_id);
  return new;
end;
$$;

create trigger trg_comments_badge_check
after insert on public.comments
for each row execute function public.trg_check_badges_on_comment();

alter table public.badges enable row level security;

create policy "Badges are viewable by everyone"
on public.badges for select
using (true);

create policy "Admins can manage badges"
on public.badges for all
using (public.is_admin())
with check (public.is_admin());

alter table public.user_badges enable row level security;

create policy "User badges are viewable by everyone"
on public.user_badges for select
using (true);

-- No insert/update/delete policy for regular clients: awarding only ever
-- happens through the SECURITY DEFINER check_and_award_badges() routine,
-- which bypasses RLS. This keeps users from self-awarding badges via the API.
