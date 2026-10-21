-- INNEV8 QR Hunt: removing hunters. An admin can delete players' hunter IDs on the admin's Hunters
-- page (test players, duplicates): their secrets and meetings go with them (on delete cascade), so
-- their hunter QRs stop working. The codes a player found stay on their phone, and their phone gets
-- a new hunter ID the next time the game opens. Recent changes says who removed them: one line for
-- each delete, however many hunters it took.

create policy "Admins remove hunters" on public.hunters for delete to authenticated using ((select public.is_admin()));

-- Deletes these hunters (as the one asking: only an admin's are deleted); how many went
create function public.delete_hunters(p_ids uuid[]) returns int
language sql security invoker set search_path = ''
as $$
  with gone as (delete from public.hunters where id = any(p_ids) returning id)
  select count(*)::int from gone
$$;

revoke execute on function public.delete_hunters(uuid[]) from public, anon;
grant execute on function public.delete_hunters(uuid[]) to authenticated;

-- One line in the log: "removed the hunter Ana", or "removed 12 hunters"
create function public.log_hunters_removed() returns trigger
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
    coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System'),
    'hunters',
    'removed',
    case when n = 1 then one else n || ' hunters' end
  );
  return null;
end $$;

create trigger log_activity after delete on public.hunters referencing old table as gone
  for each statement execute function public.log_hunters_removed();
