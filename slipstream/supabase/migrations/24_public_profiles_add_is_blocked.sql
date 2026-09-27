-- Expose is_blocked through public_profiles() so role/blocked status can be
-- shown publicly next to badges on posts/comments and on profile pages -
-- unlike email/phone_number, block status is a public moderation flag, not
-- sensitive data. CREATE OR REPLACE can't add a column to a RETURNS TABLE
-- function, so drop and recreate (nothing else references it inside a SQL
-- body - only client .rpc() calls by name - so this is safe).
drop function public.public_profiles();

create function public.public_profiles()
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
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
  select id, username, first_name, last_name, avatar_url, reputation, role, is_blocked, created_at
  from public.profiles;
$$;

revoke all on function public.public_profiles() from public;
grant execute on function public.public_profiles() to anon, authenticated;
