-- Posts can now optionally carry a single uploaded image alongside their
-- text content. Mirrors the avatars bucket pattern (migrations 11/13):
-- public read, owner-only write scoped to the author's own folder, with a
-- server-side size/type limit so the client's own checks aren't just a
-- suggestion.

alter table public.posts add column image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;

create policy "Post images are publicly accessible"
on storage.objects for select
using (bucket_id = 'post-images');

create policy "Non-blocked users can upload their own post images"
on storage.objects for insert
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not public.is_blocked()
);

create policy "Non-blocked users can update their own post images"
on storage.objects for update
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not public.is_blocked()
);

-- Removing an existing image (no new upload) is a deletion, not new content
-- creation - not gated on is_blocked(), mirroring how vote/bookmark removal
-- (unlike casting a vote or saving a post) was never blocked either.
create policy "Users can delete their own post images"
on storage.objects for delete
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Replacing or removing a post's image should mark it "(edited)" the same
-- way a title/content change does (see migration 18's gotcha about this
-- trigger's condition needing to cover every mutable column).
create or replace function public.set_posts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.title is distinct from old.title
     or new.content is distinct from old.content
     or new.image_url is distinct from old.image_url then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;
