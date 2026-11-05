-- INNEV8 QR Hunt: the sponsors in the organisers' own order. On the Sponsors page an admin drags a
-- card (by its grip) to where it should be; the cards, and the sponsor lists on the QR codes' pages,
-- then follow that order. They start in the order they had (by name), and a new sponsor goes last.
--
-- order_sponsors saves a whole new order at once, as one line in Recent changes ("changed the order
-- of the sponsors"), not a line per sponsor. Admins only, like every other change.

begin;

alter table public.sponsors add column sort int not null default 0;

-- (where each starts: not "changed" lines in Recent changes, and not "last changed" now)
alter table public.sponsors disable trigger log_activity;
alter table public.sponsors disable trigger stamp;
update public.sponsors s set sort = o.n
from (select id, row_number() over (order by lower(name), id) as n from public.sponsors) o
where s.id = o.id;
alter table public.sponsors enable trigger stamp;
alter table public.sponsors enable trigger log_activity;

-- The sponsors in this order (their ids, first to last): returns how many moved
create function public.order_sponsors(p_ids text[]) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  n int;
begin
  if not public.is_admin() then raise exception 'Only admins can change this' using errcode = '42501'; end if;
  perform set_config('innev8.quiet', 'on', true);
  update public.sponsors s set sort = o.n
  from unnest(p_ids) with ordinality as o (id, n)
  where s.id = o.id and s.sort is distinct from o.n;
  get diagnostics n = row_count;
  perform set_config('innev8.quiet', 'off', true);
  if n > 0 then
    insert into public.activity (user_id, who, what, action, label, changes)
    values (
      auth.uid(),
      coalesce((select coalesce(nullif(t.name, ''), t.email) from public.team t where t.user_id = auth.uid()), 'System'),
      'sponsors',
      'changed',
      'the sponsors',
      '{sort}'
    );
  end if;
  return n;
end $$;

revoke execute on function public.order_sponsors(text[]) from public, anon;
grant execute on function public.order_sponsors(text[]) to authenticated;

commit;
