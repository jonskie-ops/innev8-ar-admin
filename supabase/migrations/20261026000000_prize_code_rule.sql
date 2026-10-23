-- INNEV8 QR Hunt: a prize for finding one chosen QR code ("Get the Symphonics QR"). The organisers
-- pick the code and write the sentence players read; whoever finds that code wins it (a prize card,
-- the prize desk, the stock: as the other prizes).

-- Which code (none if it's been deleted since: then nobody wins it until another is chosen), and the
-- sentence players read
alter table public.prizes
  add column rule_code text references public.codes (id) on update cascade on delete set null,
  add column rule_text text check (char_length(rule_text) <= 80);

alter table public.prizes drop constraint prizes_rule_check;
alter table public.prizes add constraint prizes_rule_check check (rule in ('all', 'count', 'legendary', 'points', 'code'));
alter table public.prizes add constraint prizes_rule_text check (rule <> 'code' or char_length(btrim(coalesce(rule_text, ''))) > 0);

-- Has this hunter won this prize? (Its rule, against their standing; as the game's prizeProgress.)
-- A chosen code counts once found, like their other finds (test finds only while test mode is on).
create or replace function public.prize_won(p_hunter uuid, p_prize uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  s json := public.hunter_standing(p_hunter);
  p public.prizes;
begin
  select * into p from public.prizes where id = p_prize;
  if p.id is null then return false; end if;
  return case p.rule
    when 'all' then (s ->> 'total')::int > 0 and (s ->> 'count')::int >= (s ->> 'total')::int
    when 'count' then (s ->> 'finds')::int >= p.rule_value
    when 'legendary' then (s ->> 'legendary')::boolean
    when 'code' then exists (
      select 1 from public.finds f, public.settings st
      where f.hunter_id = p_hunter and f.code_id = p.rule_code and (st.test_mode or not f.test)
    )
    else (s ->> 'score')::int >= p.rule_value
  end;
end $$;
