create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.block_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Focus window',
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Chicago',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blocked_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  hostname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hostname)
);

create table public.override_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hostname text not null,
  method text not null check (method in ('wait', 'reason')),
  reason text,
  created_at timestamptz not null default now()
);

create index block_windows_user_enabled_idx on public.block_windows (user_id, enabled, day_of_week);
create index blocked_sites_user_idx on public.blocked_sites (user_id);
create index override_events_user_created_idx on public.override_events (user_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger block_windows_set_updated_at
before update on public.block_windows
for each row execute function public.set_updated_at();

create trigger blocked_sites_set_updated_at
before update on public.blocked_sites
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.block_windows enable row level security;
alter table public.blocked_sites enable row level security;
alter table public.override_events enable row level security;

create policy "Users can select own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can delete own profile"
on public.profiles for delete
using (auth.uid() = id);

create policy "Users can select own block windows"
on public.block_windows for select
using (auth.uid() = user_id);

create policy "Users can insert own block windows"
on public.block_windows for insert
with check (auth.uid() = user_id);

create policy "Users can update own block windows"
on public.block_windows for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own block windows"
on public.block_windows for delete
using (auth.uid() = user_id);

create policy "Users can select own blocked sites"
on public.blocked_sites for select
using (auth.uid() = user_id);

create policy "Users can insert own blocked sites"
on public.blocked_sites for insert
with check (auth.uid() = user_id);

create policy "Users can update own blocked sites"
on public.blocked_sites for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own blocked sites"
on public.blocked_sites for delete
using (auth.uid() = user_id);

create policy "Users can select own override events"
on public.override_events for select
using (auth.uid() = user_id);

create policy "Users can insert own override events"
on public.override_events for insert
with check (auth.uid() = user_id);

create policy "Users can delete own override events"
on public.override_events for delete
using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
