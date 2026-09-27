-- Username is now mandatory (it's the forum-wide lookup key) and stays unique.
alter table public.profiles
  alter column username set not null;

-- Tighten profiles visibility: the full row (incl. email, phone_number) is
-- only visible to its owner or an admin (admins still need this for
-- "search users by email"). Public/anon access moves to the public_profiles
-- view below, which only exposes non-sensitive columns.
drop policy "Profiles are viewable by everyone" on public.profiles;

create policy "Owners and admins can view full profiles"
on public.profiles for select
using ((select auth.uid()) = id or public.is_admin());

-- Safe, publicly-readable subset of a profile: what's shown next to a
-- username on posts/comments, on a public profile page, etc. Owned by the
-- migration role (bypasses RLS on the underlying table), so it exposes
-- every user's public info regardless of viewer while still hiding
-- email/phone_number simply by not selecting them.
create view public.public_profiles
as
select id, username, first_name, last_name, avatar_url, reputation, role, created_at
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- Narrow, targeted username -> email lookup for the login flow, so the
-- client never needs bulk read access to profiles.email just to support
-- "log in with username". Deliberately returns only a single email for a
-- single username, nothing else.
create function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where username = lower(p_username);
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
