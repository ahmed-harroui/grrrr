-- Adopter mode and adoption interests. Safe to run again. Run after 012 and 013.
-- 1. pets.adopter_only: an account that came to adopt skips the pet setup. Its starter pet
--    (migration 008) becomes its family profile: hidden from Discover and Trending, used only
--    to send adoption requests. Adding a real pet in My Pet turns it into that pet.
-- 2. adoption_interests: swiping a pet up in Discover. Nothing is sent then; as soon as that
--    pet has a litter listed in Adopt (a relation accepted), the adoption request is sent to
--    both parents and the family is notified.

alter table public.pets add column if not exists adopter_only boolean not null default false;

create table if not exists public.adoption_interests (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  adopter_pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pet_id, adopter_pet_id),
  check (pet_id <> adopter_pet_id)
);

create index if not exists adoption_interests_pet_idx on public.adoption_interests (pet_id);
create index if not exists adoption_interests_adopter_idx on public.adoption_interests (adopter_pet_id);

alter table public.adoption_interests enable row level security;

-- Only the waiting family sees and manages its interests (the pet's owner is not told).
drop policy if exists "Adopters can read their adoption interests" on public.adoption_interests;
create policy "Adopters can read their adoption interests" on public.adoption_interests
  for select using (exists (select 1 from public.pets where pets.id = adoption_interests.adopter_pet_id and pets.owner_id = auth.uid()));

drop policy if exists "Adopters can add adoption interests" on public.adoption_interests;
create policy "Adopters can add adoption interests" on public.adoption_interests
  for insert with check (
    exists (select 1 from public.pets where pets.id = adoption_interests.adopter_pet_id and pets.owner_id = auth.uid())
    and not exists (select 1 from public.pets where pets.id = adoption_interests.pet_id and pets.owner_id = auth.uid())
  );

drop policy if exists "Adopters can remove adoption interests" on public.adoption_interests;
create policy "Adopters can remove adoption interests" on public.adoption_interests
  for delete using (exists (select 1 from public.pets where pets.id = adoption_interests.adopter_pet_id and pets.owner_id = auth.uid()));

-- Internal: sends an adoption request for a listed litter (a conversation with each parent and
-- the request posted in it). Returns true when sent; false when it cannot be or already was.
create or replace function public.send_adoption_request(p_litter_id uuid, p_adopter_pet_id uuid)
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
  insert into public.adoption_requests (litter_id, adopter_pet_id, action)
  values (p_litter_id, p_adopter_pet_id, 'ADOPT')
  on conflict (litter_id, adopter_pet_id) do update set action = 'ADOPT', created_at = now();

  -- An adopter-only profile is the family itself, not a pet.
  v_who := case when adopter.adopter_only then adopter.pet_name else 'la famille de ' || adopter.pet_name end;
  for parent in select * from public.pets where id in (father.id, mother.id) loop
    insert into public.pet_matches (pet_one_id, pet_two_id, match_type)
    values (least(adopter.id, parent.id), greatest(adopter.id, parent.id), 'ADOPT')
    on conflict (pet_one_id, pet_two_id) do nothing;
    select id into v_match from public.pet_matches
    where pet_one_id = least(adopter.id, parent.id) and pet_two_id = greatest(adopter.id, parent.id);
    insert into public.match_messages (match_id, sender_pet_id, body)
    values (v_match, adopter.id, '🍼 Adoption : ' || v_who || ' aimerait adopter un bébé de ' || father.pet_name || ' et ' || mother.pet_name || '. Répondez ici pour en parler.');
  end loop;
  return true;
end;
$$;

revoke execute on function public.send_adoption_request(uuid, uuid) from public, anon, authenticated;

-- Same as migration 012, the sending now shared with the listing trigger below.
create or replace function public.answer_adoption(p_litter_id uuid, p_pet_id uuid, p_adopt boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  litter public.pet_litters;
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = auth.uid()) then raise exception 'Not allowed'; end if;
  select * into litter from public.pet_litters where id = p_litter_id and status = 'accepted';
  if not found then raise exception 'LITTER_CLOSED'; end if;
  if exists (select 1 from public.pets where id in (litter.father_pet_id, litter.mother_pet_id) and owner_id = auth.uid()) then
    raise exception 'OWN_LITTER';
  end if;
  if not p_adopt then
    insert into public.adoption_requests (litter_id, adopter_pet_id, action)
    values (p_litter_id, p_pet_id, 'SKIP')
    on conflict (litter_id, adopter_pet_id) do nothing;
    return false;
  end if;
  return public.send_adoption_request(p_litter_id, p_pet_id);
end;
$$;

revoke execute on function public.answer_adoption(uuid, uuid, boolean) from public, anon;
grant execute on function public.answer_adoption(uuid, uuid, boolean) to authenticated;

-- A litter is listed: every family waiting for one of its parents gets its request sent,
-- and is told.
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
    select distinct on (ai.adopter_pet_id) ai.adopter_pet_id, ai.pet_id
    from public.adoption_interests ai
    where ai.pet_id in (new.father_pet_id, new.mother_pet_id)
    order by ai.adopter_pet_id, ai.created_at
  loop
    if public.send_adoption_request(new.id, interest.adopter_pet_id) then
      perform public.notify_pet(interest.adopter_pet_id, 'adoption_listed', interest.pet_id, jsonb_build_object('litter_id', new.id));
    end if;
  end loop;
  return new;
exception when others then
  -- Never block the relation itself.
  raise warning 'Adoption interests not sent for litter %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists pet_litters_send_interests on public.pet_litters;
create trigger pet_litters_send_interests
after insert or update of status on public.pet_litters
for each row execute function public.trg_litter_listed_send_interests();

revoke execute on function public.trg_litter_listed_send_interests() from public, anon, authenticated;

notify pgrst, 'reload schema';
