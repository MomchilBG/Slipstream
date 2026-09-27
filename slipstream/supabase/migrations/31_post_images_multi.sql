-- Replace the single posts.image_url column (migration 30) with a proper
-- post_images child table so a post can carry up to 5 images, ordered by
-- position - same shape as post_tags/tags rather than a single mutable
-- column. Editing a post's images (like its tags) goes through a
-- clear-and-reattach helper rather than diffing, and - also like tags -
-- doesn't bump posts.updated_at, so it no longer needs (or gets) an
-- "(edited)" marker; revert set_posts_updated_at to its pre-image_url form.

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

alter table public.posts drop column image_url;

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  image_url text not null,
  position smallint not null,
  created_at timestamptz not null default now()
);

create index post_images_post_id_idx on public.post_images (post_id);

alter table public.post_images enable row level security;

create policy "Post images are publicly readable"
on public.post_images for select
using (true);

create policy "Post owners can add images to own posts"
on public.post_images for insert
with check (
  exists (
    select 1 from public.posts p
    where p.id = post_id and p.author_id = (select auth.uid()) and not public.is_blocked()
  )
);

create policy "Post owners can remove images from own posts"
on public.post_images for delete
using (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
);

-- Defense in depth alongside the client's own 5-image cap - counts rows
-- already inserted earlier in the same multi-row INSERT too, since those
-- are visible (uncommitted but already in the heap) to a later row's
-- BEFORE INSERT trigger invocation within the same statement.
create or replace function public.enforce_post_image_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.post_images where post_id = new.post_id) >= 5 then
    raise exception 'a post can have at most 5 images';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_post_image_limit
before insert on public.post_images
for each row execute function public.enforce_post_image_limit();
