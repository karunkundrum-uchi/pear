alter table public.friend_connections drop constraint if exists friend_connections_friend_user_id_fkey;
alter table public.friend_connections alter column friend_user_id drop not null;

alter table public.friend_connections add column if not exists friend_label text;

update public.friend_connections
set friend_label = coalesce(friend_label, friend_user_id)
where friend_label is null;

alter table public.friend_connections alter column friend_label set not null;
