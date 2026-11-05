-- INNEV8 QR Hunt: two safety fixes.
--
-- 1. A hunter who's been given a prize at the prize desk can't be deleted. Their finds and prize
--    cards go with them (on delete cascade), so the give would vanish from "Every prize given" while
--    the prize's stock stayed lowered, the desk's same-name check would no longer see it (the same
--    person could be given it again), and their confirmed finds would be gone. Prizes given in test
--    mode don't count: a tester can still be deleted.
--
-- 2. A new temporary password signs the teammate out everywhere they're signed in. Before, a
--    browser they'd stayed signed in on (a lost laptop, say) was sent to choose a new password, and
--    could, without knowing the temporary one. The admin's server calls end_sessions (with the
--    secret key) after an admin resets a password.

-- ---------------------------------------------------------------- 1. keep hunters given a prize
create function public.keep_given_hunters() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.claims c where c.hunter_id = old.id and c.claimed_at is not null and not c.test) then
    raise exception 'The hunter % was given a prize at the prize desk, so they can''t be deleted.', old.name
      using errcode = 'P0001', hint = 'given';
  end if;
  return old;
end $$;

revoke execute on function public.keep_given_hunters() from public, anon, authenticated;

create trigger keep_given before delete on public.hunters
  for each row execute function public.keep_given_hunters();

-- ---------------------------------------------------------------- 2. signed out everywhere
-- Ends every session of this sign-in (its refresh tokens go with them); how many there were
create function public.end_sessions(p_user uuid) returns int
language sql security definer set search_path = ''
as $$
  with gone as (delete from auth.sessions where user_id = p_user returning 1)
  select count(*)::int from gone
$$;

revoke execute on function public.end_sessions(uuid) from public, anon, authenticated;
grant execute on function public.end_sessions(uuid) to service_role;
