create or replace function public.claim_profile_username(profile_id text, requested_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := public.normalize_username(requested_username);

  if normalized_username is null or normalized_username = '' then
    raise exception 'Username must include at least one letter or number.';
  end if;

  if length(normalized_username) < 3 then
    raise exception 'Username must be at least 3 characters.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = profile_id
  ) then
    raise exception 'Profile not found.';
  end if;

  if exists (
    select 1
    from public.profiles
    where lower(username) = lower(normalized_username)
      and id <> profile_id
  ) then
    raise exception 'That username is already taken.';
  end if;

  update public.profiles
  set username = normalized_username
  where id = profile_id;

  return normalized_username;
end;
$$;

grant execute on function public.claim_profile_username(text, text) to authenticated;
