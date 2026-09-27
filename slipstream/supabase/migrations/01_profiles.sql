-- Profiles: extends auth.users (Supabase auth is the system of record for login/session state)
create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 4 and 32),
  last_name text not null check (char_length(last_name) between 4 and 32),
  username text unique check (username = lower(username) and char_length(username) between 3 and 32),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone_number text,
  role public.user_role not null default 'user',
  is_blocked boolean not null default false,
  reputation integer not null default 0,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);
create index profiles_role_idx on public.profiles (role);

-- Generic "touch updated_at" trigger, reused by later tables too.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Helper functions used throughout RLS policies. SECURITY DEFINER + fixed
-- search_path avoids RLS recursion and search_path hijacking.
create function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

create function public.is_blocked(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_blocked from public.profiles p where p.id = uid), false);
$$;

-- Guards: username immutable once set, role/is_blocked only settable by
-- admins, reputation only settable by the internal vote-effects routine
-- (via the app.bypass_reputation_guard local setting).
create function public.enforce_profile_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'username cannot be changed once set';
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'only admins can change role';
    end if;
    if new.is_blocked is distinct from old.is_blocked then
      raise exception 'only admins can change blocked status';
    end if;
  end if;

  if new.reputation is distinct from old.reputation
     and coalesce(current_setting('app.bypass_reputation_guard', true), 'false') <> 'true' then
    raise exception 'reputation cannot be changed directly';
  end if;

  return new;
end;
$$;

create trigger trg_profile_restrictions
before update on public.profiles
for each row execute function public.enforce_profile_restrictions();

-- Auto-create a profile row when someone signs up through Supabase auth.
-- The client must pass first_name/last_name (and optionally username) in
-- options.data on supabase.auth.signUp().
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, username)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    nullif(new.raw_user_meta_data->>'username', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
on public.profiles for select
using (true);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can update any profile"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());
