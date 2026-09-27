create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 16 and 64),
  content text not null check (char_length(content) between 32 and 8192),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_author_id_idx on public.posts (author_id);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_comment_count_idx on public.posts (comment_count desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments (post_id);
create index comments_author_id_idx on public.comments (author_id);

create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- like_count/comment_count are denormalized counters only ever written by
-- internal trigger routines (votes, comment insert/delete), never by clients.
create function public.enforce_post_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.like_count is distinct from old.like_count
      or new.comment_count is distinct from old.comment_count)
     and coalesce(current_setting('app.bypass_post_counters', true), 'false') <> 'true' then
    raise exception 'like_count and comment_count cannot be changed directly';
  end if;
  return new;
end;
$$;

create trigger trg_post_restrictions
before update on public.posts
for each row execute function public.enforce_post_restrictions();

create function public.handle_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_post_counters', 'true', true);
  update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  perform set_config('app.bypass_post_counters', 'false', true);
  return new;
end;
$$;

create trigger trg_comments_after_insert
after insert on public.comments
for each row execute function public.handle_comment_insert();

create function public.handle_comment_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_post_counters', 'true', true);
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  perform set_config('app.bypass_post_counters', 'false', true);
  return old;
end;
$$;

create trigger trg_comments_after_delete
after delete on public.comments
for each row execute function public.handle_comment_delete();

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
on public.posts for select
using (true);

create policy "Non-blocked users can create own posts"
on public.posts for insert
with check (auth.uid() = author_id and not public.is_blocked());

create policy "Authors can update own posts"
on public.posts for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Authors and admins can delete posts"
on public.posts for delete
using (auth.uid() = author_id or public.is_admin());

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
on public.comments for select
using (true);

create policy "Non-blocked users can comment"
on public.comments for insert
with check (auth.uid() = author_id and not public.is_blocked());

create policy "Authors can update own comments"
on public.comments for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Authors can delete own comments"
on public.comments for delete
using (auth.uid() = author_id);

-- Cheap aggregate for the public landing page (user count, post count).
create view public.platform_stats
with (security_invoker = true) as
select
  (select count(*) from public.profiles) as user_count,
  (select count(*) from public.posts) as post_count;

grant select on public.platform_stats to anon, authenticated;
