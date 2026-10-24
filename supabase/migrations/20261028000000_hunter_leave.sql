-- INNEV8 QR Hunt: a player deleting their own profile. The game's "Delete your profile" (Me) removes
-- their hunter ID here too, not just from their phone, so they're gone from the admin's Hunters page.
-- Only their own phone can: it's checked against the secret only that phone has. Their secret,
-- meetings, finds and prize cards go with them (on delete cascade), as when an admin deletes them.
-- Recent changes says "The player removed the hunter Ana".

create function public.hunter_leave(p_id uuid, p_secret text) returns json
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.hunter_auth(p_id, p_secret) then return json_build_object('error', 'unknown'); end if;
  -- (for Recent changes: who removed them)
  perform set_config('app.who', 'The player', true);
  delete from public.hunters where id = p_id;
  return json_build_object('ok', true);
end $$;

revoke execute on function public.hunter_leave(uuid, text) from public;
grant execute on function public.hunter_leave(uuid, text) to anon, authenticated;

-- Recent changes: an organiser by name, the player themselves, or (neither) the system
create or replace function public.log_hunters_removed() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  n int;
  one text;
begin
  select count(*), min(name) into n, one from gone;
  if n = 0 then return null; end if;
  insert into public.activity (user_id, who, what, action, label)
  values (
    auth.uid(),
    coalesce(
      (select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()),
      nullif(current_setting('app.who', true), ''),
      'System'
    ),
    'hunters',
    'removed',
    case when n = 1 then one else n || ' hunters' end
  );
  return null;
end $$;
