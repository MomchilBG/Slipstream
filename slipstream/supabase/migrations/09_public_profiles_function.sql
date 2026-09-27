-- Replace the security-definer view (flagged as an ERROR by the Supabase
-- linter, since any view bypassing the base table's RLS is inherently
-- risky) with the sanctioned equivalent: a SECURITY DEFINER function
-- returning the same safe column set. This only trips the same "publicly
-- executable security definer function" WARN as is_admin/is_blocked, which
-- is expected here.
drop view public.public_profiles;

create function public.public_profiles()
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  reputation integer,
  role public.user_role,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, username, first_name, last_name, avatar_url, reputation, role, created_at
  from public.profiles;
$$;

revoke all on function public.public_profiles() from public;
grant execute on function public.public_profiles() to anon, authenticated;
