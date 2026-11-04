-- Rune Vault: usernames + username login. Paste into Supabase -> SQL Editor and run once
-- (after 0001_init.sql).

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Create a profile for every new user. A username passed at sign-up
-- (user metadata "username") is used if it is valid and not taken.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(new.raw_user_meta_data ->> 'username');
begin
  if wanted !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.profiles where username = wanted) then
    wanted := null;
  end if;
  insert into public.profiles (id, username) values (new.id, wanted) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for users who signed up before this migration.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- Usernames are stored lowercase.
create or replace function public.normalize_username() returns trigger
language plpgsql as $$
begin
  new.username := lower(new.username);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_normalize on public.profiles;
create trigger profiles_normalize before insert or update on public.profiles
  for each row execute function public.normalize_username();

-- Is a username free? (Used by the sign-up form and account settings.)
create or replace function public.username_available(p_username text) returns boolean
language sql security definer set search_path = public stable as $$
  select lower(p_username) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------- username login
-- Supabase Auth only signs in by email, so for "username + password" the app asks
-- this function for the account's email. It only returns the email when the password
-- is correct, so it never reveals anyone's email address. Failed attempts are
-- throttled per username to slow down password guessing.
create table if not exists public.login_attempts (
  username     text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_idx on public.login_attempts (username, attempted_at);
alter table public.login_attempts enable row level security; -- no policies: only the function below uses it

create or replace function public.email_for_username_login(p_username text, p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  uname text := lower(trim(p_username));
  found_email text;
  hash text;
begin
  delete from public.login_attempts where attempted_at < now() - interval '1 day';

  if (select count(*) from public.login_attempts
      where username = uname and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many failed sign-in attempts. Try again in 15 minutes.' using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into found_email, hash
  from public.profiles p join auth.users u on u.id = p.id
  where p.username = uname;

  if hash is null or hash = '' or extensions.crypt(p_password, hash) <> hash then
    insert into public.login_attempts (username) values (uname);
    return null;
  end if;

  delete from public.login_attempts where username = uname;
  return found_email;
end $$;
grant execute on function public.email_for_username_login(text, text) to anon, authenticated;
