-- Self-service account deletion. The client re-authenticates the user with
-- signInWithPassword() before calling this RPC, so no password needs to
-- reach the database - this just performs the actual delete for the
-- already-verified caller. Deleting the auth.users row cascades to
-- profiles (on delete cascade), which in turn cascades to that user's
-- posts, comments, badges, and votes.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- Supabase grants EXECUTE on newly created public-schema functions to
-- anon/authenticated by default via default privileges - "revoke all from
-- public" above doesn't touch those direct grants, so anon still had
-- EXECUTE after the statements above. Revoke it explicitly.
revoke execute on function public.delete_own_account() from anon;
