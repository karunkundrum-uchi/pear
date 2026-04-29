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

create policy "Users can select own profile"
on public.profiles for select
using ((select auth.uid()) = id);

create policy "Users can insert own profile"
on public.profiles for insert
with check ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can delete own profile"
on public.profiles for delete
using ((select auth.uid()) = id);

create policy "Users can select own block windows"
on public.block_windows for select
using ((select auth.uid()) = user_id);

create policy "Users can insert own block windows"
on public.block_windows for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update own block windows"
on public.block_windows for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own block windows"
on public.block_windows for delete
using ((select auth.uid()) = user_id);

create policy "Users can select own blocked sites"
on public.blocked_sites for select
using ((select auth.uid()) = user_id);

create policy "Users can insert own blocked sites"
on public.blocked_sites for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update own blocked sites"
on public.blocked_sites for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own blocked sites"
on public.blocked_sites for delete
using ((select auth.uid()) = user_id);

create policy "Users can select own override events"
on public.override_events for select
using ((select auth.uid()) = user_id);

create policy "Users can insert own override events"
on public.override_events for insert
with check ((select auth.uid()) = user_id);

create policy "Users can delete own override events"
on public.override_events for delete
using ((select auth.uid()) = user_id);
