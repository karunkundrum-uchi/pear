drop policy if exists "Users can delete own friend connections" on public.friend_connections;

create policy "Users can delete visible friend connections"
on public.friend_connections for delete
to authenticated
using (user_id = (auth.jwt() ->> 'sub') or friend_user_id = (auth.jwt() ->> 'sub'));
