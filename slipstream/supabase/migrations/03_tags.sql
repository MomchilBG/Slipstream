create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name = lower(name) and char_length(name) between 1 and 32),
  created_at timestamptz not null default now()
);

create table public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

create index post_tags_tag_id_idx on public.post_tags (tag_id);

alter table public.tags enable row level security;

create policy "Tags are viewable by everyone"
on public.tags for select
using (true);

-- Any non-blocked authenticated user may add a new tag row (dedup is
-- enforced by the unique constraint on name; clients should look up an
-- existing tag by name before inserting a new one).
create policy "Non-blocked users can create tags"
on public.tags for insert
to authenticated
with check (not public.is_blocked());

create policy "Admins can update tags"
on public.tags for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete tags"
on public.tags for delete
using (public.is_admin());

alter table public.post_tags enable row level security;

create policy "Post tags are viewable by everyone"
on public.post_tags for select
using (true);

create policy "Post owners and admins can tag posts"
on public.post_tags for insert
with check (
  public.is_admin()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);

create policy "Post owners and admins can untag posts"
on public.post_tags for delete
using (
  public.is_admin()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);
