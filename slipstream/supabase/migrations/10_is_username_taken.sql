-- Lets the register form check username availability before submitting.
-- supabase-js's signUp() masks the underlying unique-constraint violation
-- behind a generic "Database error saving new user" message, so relying on
-- that error text to show a friendly "username taken" message doesn't work -
-- this needs to be checked proactively instead. Returns only a boolean,
-- never any profile data.
create function public.is_username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where username = lower(p_username));
$$;

revoke all on function public.is_username_taken(text) from public;
grant execute on function public.is_username_taken(text) to anon, authenticated;
