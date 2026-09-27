-- Profile description ("bio"): optional, so no not-null; capped at 500
-- chars since it's meant to be a short blurb, not another post. No new
-- update policy needed - "Users and admins can update profiles" (migration
-- 06) already covers any column on a user's own row, same as first_name/
-- last_name/avatar_url, and enforce_profile_restrictions() (migration 01)
-- is a deny-list (username/role/is_blocked/reputation) rather than an
-- allow-list, so it doesn't need to know about this column either.
alter table public.profiles add column bio text check (bio is null or char_length(bio) <= 500);

-- Public, like first_name/last_name/avatar_url - a bio is meant to be read
-- by any visitor to a profile page. CREATE OR REPLACE can't add a column to
-- a RETURNS TABLE function, so drop and recreate (see migration 24 for the
-- same note - nothing references this by anything but name).
drop function public.public_profiles();

create function public.public_profiles()
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  reputation integer,
  role public.user_role,
  is_blocked boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, username, first_name, last_name, avatar_url, bio, reputation, role, is_blocked, created_at
  from public.profiles;
$$;

revoke all on function public.public_profiles() from public;
grant execute on function public.public_profiles() to anon, authenticated;
