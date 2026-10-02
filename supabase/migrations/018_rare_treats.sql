-- Rare treats. Safe to run again. Run after 017.
-- Treats were easy to collect (10 per match, 5 per outing, amount chosen by the phone).
-- Now: 1 treat per match, 2 per outing, capped here whatever the app asks.
-- A real outing (migration 017) earns its 2 treats when it is accepted, for both pets.

create or replace function public.award_treats(p_pet_id uuid, p_amount integer, p_reason text, p_context_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_balance integer;
  v_amount integer := least(p_amount, case when p_reason = 'outing' then 2 else 1 end);
begin
  if current_user_id is null or v_amount <= 0 then
    return null;
  end if;

  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = current_user_id) then
    return null;
  end if;

  insert into public.treat_events (pet_id, reason, context_key, amount)
  values (p_pet_id, p_reason, p_context_key, v_amount)
  on conflict (pet_id, context_key) do nothing;

  if found then
    update public.pets
    set treats = treats + v_amount,
      matches_count = matches_count + case when p_reason = 'match' then 1 else 0 end,
      outings_count = outings_count + case when p_reason = 'outing' then 1 else 0 end,
      updated_at = now()
    where id = p_pet_id
    returning treats into new_balance;
  else
    select treats into new_balance from public.pets where id = p_pet_id;
  end if;

  return coalesce(new_balance, 0);
end;
$$;

-- An outing accepted: 2 treats for each of the two pets, once per outing.
create or replace function public.trg_meeting_accepted_treats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet uuid;
begin
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;
  for v_pet in
    select unnest(array[pet_one_id, pet_two_id]) from public.pet_matches where id = new.match_id
  loop
    insert into public.treat_events (pet_id, reason, context_key, amount)
    values (v_pet, 'outing', 'outing:' || new.id, 2)
    on conflict (pet_id, context_key) do nothing;
    if found then
      update public.pets set treats = treats + 2, outings_count = outings_count + 1, updated_at = now() where id = v_pet;
    end if;
  end loop;
  return new;
exception when others then
  -- Never block the answer itself.
  raise warning 'Outing treats not given for proposal %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists meeting_proposals_accepted_treats on public.meeting_proposals;
create trigger meeting_proposals_accepted_treats
after update of status on public.meeting_proposals
for each row execute function public.trg_meeting_accepted_treats();

revoke execute on function public.trg_meeting_accepted_treats() from public, anon, authenticated;

notify pgrst, 'reload schema';
