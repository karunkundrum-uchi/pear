drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy "Users can select own profile" on public.profiles;
drop policy "Users can insert own profile" on public.profiles;
drop policy "Users can update own profile" on public.profiles;
drop policy "Users can delete own profile" on public.profiles;
drop policy "Users can select own block windows" on public.block_windows;
drop policy "Users can insert own block windows" on public.block_windows;
drop policy "Users can update own block windows" on public.block_windows;
drop policy "Users can delete own block windows" on public.block_windows;
drop policy "Users can select own blocked sites" on public.blocked_sites;
drop policy "Users can insert own blocked sites" on public.blocked_sites;
drop policy "Users can update own blocked sites" on public.blocked_sites;
drop policy "Users can delete own blocked sites" on public.blocked_sites;
drop policy "Users can select own override events" on public.override_events;
drop policy "Users can insert own override events" on public.override_events;
drop policy "Users can delete own override events" on public.override_events;

alter table public.override_events drop constraint if exists override_events_user_id_fkey;
alter table public.blocked_sites drop constraint if exists blocked_sites_user_id_fkey;
alter table public.block_windows drop constraint if exists block_windows_user_id_fkey;
alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id type text using id::text;

alter table public.block_windows
  alter column user_id type text using user_id::text;

alter table public.blocked_sites
  alter column user_id type text using user_id::text;

alter table public.override_events
  alter column user_id type text using user_id::text;

create policy "Users can select own profile"
on public.profiles for select
to authenticated
using ((auth.jwt() ->> 'sub') = id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((auth.jwt() ->> 'sub') = id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((auth.jwt() ->> 'sub') = id)
with check ((auth.jwt() ->> 'sub') = id);

create policy "Users can delete own profile"
on public.profiles for delete
to authenticated
using ((auth.jwt() ->> 'sub') = id);

create policy "Users can select own block windows"
on public.block_windows for select
to authenticated
using ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can insert own block windows"
on public.block_windows for insert
to authenticated
with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can update own block windows"
on public.block_windows for update
to authenticated
using ((auth.jwt() ->> 'sub') = user_id)
with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete own block windows"
on public.block_windows for delete
to authenticated
using ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can select own blocked sites"
on public.blocked_sites for select
to authenticated
using ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can insert own blocked sites"
on public.blocked_sites for insert
to authenticated
with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can update own blocked sites"
on public.blocked_sites for update
to authenticated
using ((auth.jwt() ->> 'sub') = user_id)
with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete own blocked sites"
on public.blocked_sites for delete
to authenticated
using ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can select own override events"
on public.override_events for select
to authenticated
using ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can insert own override events"
on public.override_events for insert
to authenticated
with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete own override events"
on public.override_events for delete
to authenticated
using ((auth.jwt() ->> 'sub') = user_id);
