alter table public.profiles add column if not exists username text;

create or replace function public.normalize_username(input text)
returns text
language sql
immutable
as $$
  select trim(both '_' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9_]+', '_', 'g'));
$$;

create or replace function public.ensure_profile_username(profile_id text, requested_username text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_username text;
  base_candidate text;
  candidate text;
  suffix int := 0;
begin
  select username into existing_username
  from public.profiles
  where id = profile_id;

  if existing_username is not null and existing_username <> '' then
    return existing_username;
  end if;

  select normalize_username(
    coalesce(
      requested_username,
      email,
      display_name,
      'pearuser'
    )
  )
  into base_candidate
  from public.profiles
  where id = profile_id;

  if base_candidate is null or base_candidate = '' then
    base_candidate := 'pearuser';
  end if;

  candidate := base_candidate;

  loop
    exit when not exists (
      select 1
      from public.profiles
      where lower(username) = lower(candidate)
        and id <> profile_id
    );

    suffix := suffix + 1;
    candidate := base_candidate || suffix::text;
  end loop;

  update public.profiles
  set username = candidate
  where id = profile_id;

  return candidate;
end;
$$;

update public.profiles
set username = null
where username is null or username = '';

do $$
declare
  profile_record record;
begin
  for profile_record in
    select id, coalesce(email, display_name, 'pearuser') as requested_username
    from public.profiles
    where username is null or username = ''
  loop
    perform public.ensure_profile_username(profile_record.id, profile_record.requested_username);
  end loop;
end $$;

alter table public.profiles alter column username set not null;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
