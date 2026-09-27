-- Lets a user bookmark posts privately. Viewable and removable only by the
-- saver; only INSERT is gated on not being blocked, matching how vote
-- removal ("Users can remove own vote") stays open to blocked users while
-- casting a new vote does not.
create table public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index saved_posts_post_id_idx on public.saved_posts (post_id);

alter table public.saved_posts enable row level security;

create policy "Users can view own saved posts"
on public.saved_posts for select
using ((select auth.uid()) = user_id);

create policy "Non-blocked users can save posts"
on public.saved_posts for insert
with check ((select auth.uid()) = user_id and not public.is_blocked());

create policy "Users can unsave own saved posts"
on public.saved_posts for delete
using ((select auth.uid()) = user_id);
