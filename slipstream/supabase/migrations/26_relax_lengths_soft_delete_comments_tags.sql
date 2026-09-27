-- 1. Relax post title/content minimums: title 16->4, content 32->16.
alter table public.posts drop constraint posts_title_check;
alter table public.posts add constraint posts_title_check check (char_length(title) between 4 and 64);

alter table public.posts drop constraint posts_content_check;
alter table public.posts add constraint posts_content_check check (char_length(content) between 16 and 8192);

-- 2. Last name becomes optional at registration - drop the not-null and
-- only enforce the 4-32 length when a value is actually given.
alter table public.profiles alter column last_name drop not null;
alter table public.profiles drop constraint profiles_last_name_check;
alter table public.profiles add constraint profiles_last_name_check
  check (last_name is null or char_length(last_name) between 4 and 32);

-- 3. Admins may still untag a post but no longer add tags to one - only a
-- post's own author can insert into post_tags now.
drop policy "Post owners and admins can tag posts" on public.post_tags;
create policy "Post owners can tag posts"
on public.post_tags for insert
with check (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
);

-- 4. Deleting a comment now soft-deletes it (content replaced with
-- "[deleted]") instead of removing the row, so replies keep their place in
-- the thread instead of being orphaned by the ON DELETE SET NULL cascade
-- from migration 16/19. The existing "authors can update own comments"
-- policy already covers a user soft-deleting their own comment (it's just
-- another content update); admins need a new policy to do the same to any
-- comment, since they don't own it.
alter table public.comments add column is_deleted boolean not null default false;

create policy "Admins can update any comment"
on public.comments for update
using (public.is_admin())
with check (public.is_admin());
