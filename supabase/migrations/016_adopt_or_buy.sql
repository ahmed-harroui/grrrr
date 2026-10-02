-- Adopt or buy. Safe to run again. Run after 015.
-- Swiping a pet up in Discover now asks whether the family wants to adopt or to buy one of
-- its babies. The choice is kept with the wait (adoption_interests) and with the request
-- (adoption_requests), and the message posted to the parents says which one it is.

alter table public.adoption_interests add column if not exists intent text not null default 'ADOPT';
alter table public.adoption_interests drop constraint if exists adoption_interests_intent_check;
alter table public.adoption_interests add constraint adoption_interests_intent_check check (intent in ('ADOPT', 'BUY'));

alter table public.adoption_requests add column if not exists intent text not null default 'ADOPT';
alter table public.adoption_requests drop constraint if exists adoption_requests_intent_check;
alter table public.adoption_requests add constraint adoption_requests_intent_check check (intent in ('ADOPT', 'BUY'));

-- The two-argument version of migration 015 is replaced by this one (a default argument would
-- make the old call ambiguous).
drop function if exists public.send_adoption_request(uuid, uuid);

create or replace function public.send_adoption_request(p_litter_id uuid, p_adopter_pet_id uuid, p_intent text default 'ADOPT')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  adopter public.pets;
  litter public.pet_litters;
  father public.pets;
  mother public.pets;
  parent public.pets;
  previous text;
  v_match uuid;
  v_who text;
  v_intent text := case when upper(coalesce(p_intent, '')) = 'BUY' then 'BUY' else 'ADOPT' end;
begin
  select * into adopter from public.pets where id = p_adopter_pet_id;
  if not found then return false; end if;
  select * into litter from public.pet_litters where id = p_litter_id and status = 'accepted';
  if not found then return false; end if;
  select * into father from public.pets where id = litter.father_pet_id;
  select * into mother from public.pets where id = litter.mother_pet_id;
  if adopter.owner_id in (father.owner_id, mother.owner_id) then return false; end if;

  select action into previous from public.adoption_requests where litter_id = p_litter_id and adopter_pet_id = p_adopter_pet_id;
  if previous = 'ADOPT' then return false; end if;
  insert into public.adoption_requests (litter_id, adopter_pet_id, action, intent)
  values (p_litter_id, p_adopter_pet_id, 'ADOPT', v_intent)
  on conflict (litter_id, adopter_pet_id) do update set action = 'ADOPT', intent = excluded.intent, created_at = now();

  -- An adopter-only profile is the family itself, not a pet.
  v_who := case when adopter.adopter_only then adopter.pet_name else 'la famille de ' || adopter.pet_name end;
  for parent in select * from public.pets where id in (father.id, mother.id) loop
    insert into public.pet_matches (pet_one_id, pet_two_id, match_type)
    values (least(adopter.id, parent.id), greatest(adopter.id, parent.id), 'ADOPT')
    on conflict (pet_one_id, pet_two_id) do nothing;
    select id into v_match from public.pet_matches
    where pet_one_id = least(adopter.id, parent.id) and pet_two_id = greatest(adopter.id, parent.id);
    insert into public.match_messages (match_id, sender_pet_id, body)
    values (v_match, adopter.id, case when v_intent = 'BUY'
      then '🍼 Achat : ' || v_who || ' aimerait acheter un bébé de ' || father.pet_name || ' et ' || mother.pet_name || '. Répondez ici pour en parler.'
      else '🍼 Adoption : ' || v_who || ' aimerait adopter un bébé de ' || father.pet_name || ' et ' || mother.pet_name || '. Répondez ici pour en parler.'
    end);
  end loop;
  return true;
end;
$$;

revoke execute on function public.send_adoption_request(uuid, uuid, text) from public, anon, authenticated;

-- The waiting families' requests leave with the choice they made.
create or replace function public.trg_litter_listed_send_interests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  interest record;
begin
  if new.status <> 'accepted' or (tg_op = 'UPDATE' and old.status = 'accepted') then return new; end if;
  for interest in
    select distinct on (ai.adopter_pet_id) ai.adopter_pet_id, ai.pet_id, ai.intent
    from public.adoption_interests ai
    where ai.pet_id in (new.father_pet_id, new.mother_pet_id)
    order by ai.adopter_pet_id, ai.created_at
  loop
    if public.send_adoption_request(new.id, interest.adopter_pet_id, interest.intent) then
      perform public.notify_pet(interest.adopter_pet_id, 'adoption_listed', interest.pet_id, jsonb_build_object('litter_id', new.id, 'intent', interest.intent));
    end if;
  end loop;
  return new;
exception when others then
  -- Never block the relation itself.
  raise warning 'Adoption interests not sent for litter %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke execute on function public.trg_litter_listed_send_interests() from public, anon, authenticated;

notify pgrst, 'reload schema';
