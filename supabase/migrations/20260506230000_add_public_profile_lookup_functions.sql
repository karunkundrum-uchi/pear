create or replace function public.find_profile_by_username(requested_username text)
returns table (
  id text,
  username text,
  display_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select profile.id, profile.username, profile.display_name
  from public.profiles profile
  where lower(profile.username) = lower(trim(both from requested_username))
  limit 1;
$$;

create or replace function public.get_public_profiles(profile_ids text[])
returns table (
  id text,
  username text,
  display_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select profile.id, profile.username, profile.display_name
  from public.profiles profile
  where profile.id = any(profile_ids);
$$;

grant execute on function public.find_profile_by_username(text) to authenticated;
grant execute on function public.get_public_profiles(text[]) to authenticated;
