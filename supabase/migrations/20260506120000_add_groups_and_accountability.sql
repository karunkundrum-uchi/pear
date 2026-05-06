create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_user_id text not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  expires_at timestamptz not null,
  accepted_by_user_id text references public.profiles(id) on delete set null,
  status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now()
);

create table public.friend_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  friend_user_id text references public.profiles(id) on delete cascade,
  friend_label text not null,
  status text not null check (status in ('pending', 'active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, friend_user_id),
  check (friend_user_id is null or user_id <> friend_user_id)
);

create table public.accountability_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  group_membership_id uuid references public.group_memberships(id) on delete cascade,
  friend_connection_id uuid references public.friend_connections(id) on delete cascade,
  scope_type text not null check (scope_type in ('group_default', 'membership_override', 'friend_default')),
  exposure_level text not null check (exposure_level in ('event_only', 'reason_summary', 'counts_only')),
  notification_cadence text not null check (notification_cadence in ('realtime', 'daily_digest', 'weekly_digest', 'off')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'group_default' and group_id is not null and group_membership_id is null and friend_connection_id is null)
    or
    (scope_type = 'membership_override' and group_id is null and group_membership_id is not null and friend_connection_id is null)
    or
    (scope_type = 'friend_default' and group_id is null and group_membership_id is null and friend_connection_id is not null)
  )
);

create unique index accountability_preferences_group_default_idx
on public.accountability_preferences (owner_user_id, group_id)
where scope_type = 'group_default';

create unique index accountability_preferences_group_member_override_idx
on public.accountability_preferences (owner_user_id, group_membership_id)
where scope_type = 'membership_override';

create unique index accountability_preferences_friend_default_idx
on public.accountability_preferences (owner_user_id, friend_connection_id)
where scope_type = 'friend_default';

create index groups_owner_idx on public.groups (owner_user_id, created_at desc);
create index group_memberships_user_idx on public.group_memberships (user_id, status, created_at desc);
create index group_invites_inviter_idx on public.group_invites (inviter_user_id, created_at desc);
create index friend_connections_user_idx on public.friend_connections (user_id, status, created_at desc);
create index accountability_preferences_owner_idx on public.accountability_preferences (owner_user_id, created_at desc);

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create trigger group_memberships_set_updated_at
before update on public.group_memberships
for each row execute function public.set_updated_at();

create trigger friend_connections_set_updated_at
before update on public.friend_connections
for each row execute function public.set_updated_at();

create trigger accountability_preferences_set_updated_at
before update on public.accountability_preferences
for each row execute function public.set_updated_at();

alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_invites enable row level security;
alter table public.friend_connections enable row level security;
alter table public.accountability_preferences enable row level security;

create policy "Users can select owned groups"
on public.groups for select
to authenticated
using (
  owner_user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.group_memberships membership
    where membership.group_id = groups.id
      and membership.user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can insert owned groups"
on public.groups for insert
to authenticated
with check (owner_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can update owned groups"
on public.groups for update
to authenticated
using (owner_user_id = (auth.jwt() ->> 'sub'))
with check (owner_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can delete owned groups"
on public.groups for delete
to authenticated
using (owner_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can select visible memberships"
on public.group_memberships for select
to authenticated
using (
  user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.groups grp
    where grp.id = group_memberships.group_id
      and grp.owner_user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can insert own memberships or memberships for owned groups"
on public.group_memberships for insert
to authenticated
with check (
  user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.groups grp
    where grp.id = group_memberships.group_id
      and grp.owner_user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can update own memberships or memberships for owned groups"
on public.group_memberships for update
to authenticated
using (
  user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.groups grp
    where grp.id = group_memberships.group_id
      and grp.owner_user_id = (auth.jwt() ->> 'sub')
  )
)
with check (
  user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.groups grp
    where grp.id = group_memberships.group_id
      and grp.owner_user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can delete own memberships or memberships for owned groups"
on public.group_memberships for delete
to authenticated
using (
  user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.groups grp
    where grp.id = group_memberships.group_id
      and grp.owner_user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can select group invites they sent or received"
on public.group_invites for select
to authenticated
using (
  inviter_user_id = (auth.jwt() ->> 'sub')
  or accepted_by_user_id = (auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.group_memberships membership
    where membership.group_id = group_invites.group_id
      and membership.user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can insert invites for owned groups"
on public.group_invites for insert
to authenticated
with check (
  inviter_user_id = (auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.groups grp
    where grp.id = group_invites.group_id
      and grp.owner_user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "Users can update invites they sent or accepted"
on public.group_invites for update
to authenticated
using (
  inviter_user_id = (auth.jwt() ->> 'sub')
  or accepted_by_user_id = (auth.jwt() ->> 'sub')
)
with check (
  inviter_user_id = (auth.jwt() ->> 'sub')
  or accepted_by_user_id = (auth.jwt() ->> 'sub')
);

create policy "Users can delete invites they sent"
on public.group_invites for delete
to authenticated
using (inviter_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can select own friend connections"
on public.friend_connections for select
to authenticated
using (user_id = (auth.jwt() ->> 'sub') or friend_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can insert own friend connections"
on public.friend_connections for insert
to authenticated
with check (user_id = (auth.jwt() ->> 'sub'));

create policy "Users can update own friend connections"
on public.friend_connections for update
to authenticated
using (user_id = (auth.jwt() ->> 'sub') or friend_user_id = (auth.jwt() ->> 'sub'))
with check (user_id = (auth.jwt() ->> 'sub') or friend_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can delete own friend connections"
on public.friend_connections for delete
to authenticated
using (user_id = (auth.jwt() ->> 'sub'));

create policy "Users can select own accountability preferences"
on public.accountability_preferences for select
to authenticated
using (owner_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can insert own accountability preferences"
on public.accountability_preferences for insert
to authenticated
with check (owner_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can update own accountability preferences"
on public.accountability_preferences for update
to authenticated
using (owner_user_id = (auth.jwt() ->> 'sub'))
with check (owner_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can delete own accountability preferences"
on public.accountability_preferences for delete
to authenticated
using (owner_user_id = (auth.jwt() ->> 'sub'));
