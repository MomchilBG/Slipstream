-- Bug: platform_stats was a `security_invoker = true` view, so its
-- `count(*) from public.profiles` subquery ran under the QUERYING USER's
-- own RLS on profiles ("Owners and admins can view full profiles" -
-- migration 08), not a true global count. A logged-in non-admin user only
-- ever sees their own profile row, so user_count was always 1 (or 0 for a
-- signed-out visitor) regardless of how many people had actually
-- registered. post_count was unaffected since posts RLS already allows
-- public read.
--
-- Fix the same way migration 09 already fixed an identical issue for
-- public_profiles: a SECURITY DEFINER function, since these are aggregate
-- counts (not individual rows), not the sensitive per-row data profiles
-- RLS exists to protect.
drop view public.platform_stats;

create function public.platform_stats()
returns table (
  user_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles) as user_count,
    (select count(*) from public.posts) as post_count;
$$;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;
