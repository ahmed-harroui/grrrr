-- Relation and adoption. Safe to run again.
-- 1. pet_litters: two matched pets (a male and a female of the same species) agree, from
--    their chat, to have babies to entrust to adopters. One owner proposes, the other answers.
--    Once accepted, the litter is listed in Explore > Adopt.
-- 2. adoption_requests: what another pet's owner answered to a listed litter (adopt or skip).
--    "Adopt" opens a conversation with each parent (a pet_matches row of type ADOPT) and
--    posts a message in it, so both parents are told and can answer.
-- Every write goes through the functions below; chat messages starting with 💞 (relation)
-- or 🍼 (adoption) are shown as cards by the app.

-- Conversations opened by an adoption request are matches of their own type.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.pet_matches'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%match_type%'
  loop
    execute format('alter table public.pet_matches drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.pet_matches add constraint pet_matches_match_type_check check (match_type in ('FRIEND', 'LOVE', 'BOTH', 'ADOPT'));

create table if not exists public.pet_litters (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.pet_matches(id) on delete cascade,
  father_pet_id uuid not null references public.pets(id) on delete cascade,
  mother_pet_id uuid not null references public.pets(id) on delete cascade,
  proposer_pet_id uuid not null references public.pets(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'closed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (father_pet_id <> mother_pet_id)
);

create index if not exists pet_litters_status_idx on public.pet_litters (status, responded_at desc);
create index if not exists pet_litters_father_idx on public.pet_litters (father_pet_id);
create index if not exists pet_litters_mother_idx on public.pet_litters (mother_pet_id);

alter table public.pet_litters enable row level security;

-- Listed litters are public; the others are only seen by the two parents' owners.
drop policy if exists "Listed litters and own litters can be read" on public.pet_litters;
create policy "Listed litters and own litters can be read" on public.pet_litters
  for select using (
    auth.uid() is not null and (
      status = 'accepted'
      or exists (select 1 from public.pets where pets.id in (pet_litters.father_pet_id, pet_litters.mother_pet_id) and pets.owner_id = auth.uid())
    )
  );

create table if not exists public.adoption_requests (
  id uuid primary key default gen_random_uuid(),
  litter_id uuid not null references public.pet_litters(id) on delete cascade,
  adopter_pet_id uuid not null references public.pets(id) on delete cascade,
  action text not null check (action in ('ADOPT', 'SKIP')),
  created_at timestamptz not null default now(),
  unique (litter_id, adopter_pet_id)
);

create index if not exists adoption_requests_adopter_idx on public.adoption_requests (adopter_pet_id);

alter table public.adoption_requests enable row level security;

drop policy if exists "Adopters and parents can read adoption requests" on public.adoption_requests;
create policy "Adopters and parents can read adoption requests" on public.adoption_requests
  for select using (
    exists (select 1 from public.pets where pets.id = adoption_requests.adopter_pet_id and pets.owner_id = auth.uid())
    or exists (
      select 1 from public.pet_litters l
      join public.pets on pets.id in (l.father_pet_id, l.mother_pet_id)
      where l.id = adoption_requests.litter_id and pets.owner_id = auth.uid()
    )
  );

-- My pet proposes a relation to a pet it matched with. Errors the app explains:
-- NOT_MATCHED, DIFFERENT_SPECIES, SAME_GENDER.
create or replace function public.propose_litter(p_pet_id uuid, p_other_pet_id uuid)
returns public.pet_litters
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.pets;
  other public.pets;
  v_match uuid;
  v_father uuid;
  v_mother uuid;
  litter public.pet_litters;
begin
  select * into me from public.pets where id = p_pet_id and owner_id = auth.uid();
  if not found then raise exception 'Not allowed'; end if;
  select * into other from public.pets where id = p_other_pet_id;
  if not found or other.owner_id = me.owner_id then raise exception 'Not allowed'; end if;

  select id into v_match from public.pet_matches
  where pet_one_id = least(me.id, other.id) and pet_two_id = greatest(me.id, other.id) and match_type <> 'ADOPT';
  if v_match is null then raise exception 'NOT_MATCHED'; end if;
  if lower(me.species) <> lower(other.species) then raise exception 'DIFFERENT_SPECIES'; end if;
  if upper(coalesce(me.gender, '')) not in ('M', 'F') or upper(coalesce(other.gender, '')) not in ('M', 'F')
     or upper(me.gender) = upper(other.gender) then
    raise exception 'SAME_GENDER';
  end if;
  v_father := case when upper(me.gender) = 'M' then me.id else other.id end;
  v_mother := case when upper(me.gender) = 'M' then other.id else me.id end;

  select * into litter from public.pet_litters where match_id = v_match for update;
  if found then
    -- Already proposed or listed: nothing new to send.
    if litter.status in ('pending', 'accepted') then return litter; end if;
    update public.pet_litters
    set status = 'pending', proposer_pet_id = me.id, father_pet_id = v_father, mother_pet_id = v_mother, responded_at = null, updated_at = now()
    where id = litter.id
    returning * into litter;
  else
    insert into public.pet_litters (match_id, father_pet_id, mother_pet_id, proposer_pet_id)
    values (v_match, v_father, v_mother, me.id)
    returning * into litter;
  end if;

  insert into public.match_messages (match_id, sender_pet_id, body)
  values (v_match, me.id, '💞 Relation proposée : ' || me.pet_name || ' propose à ' || other.pet_name || ' d''avoir des bébés à confier à l''adoption.');
  return litter;
end;
$$;

-- The other owner accepts (the litter is listed in Adopt) or declines.
create or replace function public.respond_to_litter(p_litter_id uuid, p_accept boolean)
returns public.pet_litters
language plpgsql
security definer
set search_path = public
as $$
declare
  litter public.pet_litters;
  v_pet uuid;
begin
  select * into litter from public.pet_litters where id = p_litter_id for update;
  if not found then raise exception 'Litter not found'; end if;
  select id into v_pet from public.pets
  where owner_id = auth.uid() and id in (litter.father_pet_id, litter.mother_pet_id) and id <> litter.proposer_pet_id
  limit 1;
  if v_pet is null then raise exception 'Not allowed'; end if;
  if litter.status <> 'pending' then return litter; end if;

  update public.pet_litters
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now(), updated_at = now()
  where id = p_litter_id
  returning * into litter;

  insert into public.match_messages (match_id, sender_pet_id, body)
  values (litter.match_id, v_pet, case when p_accept
    then '💞 Relation acceptée : leurs futurs bébés sont proposés dans Adopt.'
    else '💞 Relation refusée : pas de bébés pour le moment.' end);
  return litter;
end;
$$;

-- Either owner withdraws: a pending proposal is cancelled, a listed litter leaves Adopt.
create or replace function public.close_litter(p_litter_id uuid)
returns public.pet_litters
language plpgsql
security definer
set search_path = public
as $$
declare
  litter public.pet_litters;
  v_pet uuid;
begin
  select * into litter from public.pet_litters where id = p_litter_id for update;
  if not found then raise exception 'Litter not found'; end if;
  select id into v_pet from public.pets
  where owner_id = auth.uid() and id in (litter.father_pet_id, litter.mother_pet_id)
  limit 1;
  if v_pet is null then raise exception 'Not allowed'; end if;
  if litter.status not in ('pending', 'accepted') then return litter; end if;

  update public.pet_litters
  set status = 'closed', responded_at = now(), updated_at = now()
  where id = p_litter_id
  returning * into litter;

  insert into public.match_messages (match_id, sender_pet_id, body)
  values (litter.match_id, v_pet, '💞 Relation retirée : l''annonce n''est plus proposée dans Adopt.');
  return litter;
end;
$$;

-- Litters my pet can still answer: listed, from other owners, newest first, with both
-- parents and their owners' names (profiles are not readable by other accounts).
create or replace function public.get_adoption_feed(p_pet_id uuid)
returns table (litter_id uuid, listed_at timestamptz, litter_species text, father jsonb, mother jsonb, requests integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.pets where pets.id = p_pet_id and pets.owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  return query
    select l.id, coalesce(l.responded_at, l.created_at), f.species,
           jsonb_build_object('id', f.id, 'name', f.pet_name, 'breed', f.breed, 'age', f.age, 'city', f.city, 'bio', f.bio, 'photo', f.photo_url,
             'owner', coalesce(nullif(trim(fp.display_name), ''), ''), 'owner_avatar', coalesce(fp.avatar_url, '')),
           jsonb_build_object('id', m.id, 'name', m.pet_name, 'breed', m.breed, 'age', m.age, 'city', m.city, 'bio', m.bio, 'photo', m.photo_url,
             'owner', coalesce(nullif(trim(mp.display_name), ''), ''), 'owner_avatar', coalesce(mp.avatar_url, '')),
           (select count(*) from public.adoption_requests r where r.litter_id = l.id and r.action = 'ADOPT')::integer
    from public.pet_litters l
    join public.pets f on f.id = l.father_pet_id
    join public.pets m on m.id = l.mother_pet_id
    left join public.profiles fp on fp.user_id = f.owner_id
    left join public.profiles mp on mp.user_id = m.owner_id
    where l.status = 'accepted'
      and f.owner_id <> auth.uid() and m.owner_id <> auth.uid()
      and not exists (select 1 from public.adoption_requests r where r.litter_id = l.id and r.adopter_pet_id = p_pet_id)
    order by coalesce(l.responded_at, l.created_at) desc;
end;
$$;

-- My pet's answer to a listed litter. Adopt: a conversation is opened with each parent and
-- the request is posted in it. Returns true when the request was sent.
-- Errors the app explains: LITTER_CLOSED, OWN_LITTER.
create or replace function public.answer_adoption(p_litter_id uuid, p_pet_id uuid, p_adopt boolean)
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
begin
  select * into adopter from public.pets where id = p_pet_id and owner_id = auth.uid();
  if not found then raise exception 'Not allowed'; end if;
  select * into litter from public.pet_litters where id = p_litter_id and status = 'accepted';
  if not found then raise exception 'LITTER_CLOSED'; end if;
  select * into father from public.pets where id = litter.father_pet_id;
  select * into mother from public.pets where id = litter.mother_pet_id;
  if father.owner_id = auth.uid() or mother.owner_id = auth.uid() then raise exception 'OWN_LITTER'; end if;

  select action into previous from public.adoption_requests where litter_id = p_litter_id and adopter_pet_id = p_pet_id;
  insert into public.adoption_requests (litter_id, adopter_pet_id, action)
  values (p_litter_id, p_pet_id, case when p_adopt then 'ADOPT' else 'SKIP' end)
  on conflict (litter_id, adopter_pet_id) do update set action = excluded.action, created_at = now();
  -- Skipped, or already asked: the parents are not told twice.
  if not p_adopt or previous = 'ADOPT' then return false; end if;

  for parent in select * from public.pets where id in (father.id, mother.id) loop
    insert into public.pet_matches (pet_one_id, pet_two_id, match_type)
    values (least(adopter.id, parent.id), greatest(adopter.id, parent.id), 'ADOPT')
    on conflict (pet_one_id, pet_two_id) do nothing;
    select id into v_match from public.pet_matches
    where pet_one_id = least(adopter.id, parent.id) and pet_two_id = greatest(adopter.id, parent.id);
    insert into public.match_messages (match_id, sender_pet_id, body)
    values (v_match, adopter.id, '🍼 Adoption : la famille de ' || adopter.pet_name || ' aimerait adopter un bébé de ' || father.pet_name || ' et ' || mother.pet_name || '. Répondez ici pour en parler.');
  end loop;
  return true;
end;
$$;

revoke execute on function public.propose_litter(uuid, uuid) from public, anon;
revoke execute on function public.respond_to_litter(uuid, boolean) from public, anon;
revoke execute on function public.close_litter(uuid) from public, anon;
revoke execute on function public.get_adoption_feed(uuid) from public, anon;
revoke execute on function public.answer_adoption(uuid, uuid, boolean) from public, anon;
grant execute on function public.propose_litter(uuid, uuid) to authenticated;
grant execute on function public.respond_to_litter(uuid, boolean) to authenticated;
grant execute on function public.close_litter(uuid) to authenticated;
grant execute on function public.get_adoption_feed(uuid) to authenticated;
grant execute on function public.answer_adoption(uuid, uuid, boolean) to authenticated;

-- Notifications (migration 011). An adoption conversation is not announced as a match:
-- its first message is the notification.
create or replace function public.notify_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.match_type = 'ADOPT' then return new; end if;
  perform public.notify_pet(new.pet_one_id, 'match', new.pet_two_id, jsonb_build_object('match_id', new.id, 'match_type', new.match_type));
  perform public.notify_pet(new.pet_two_id, 'match', new.pet_one_id, jsonb_build_object('match_id', new.id, 'match_type', new.match_type));
  return new;
end;
$$;

-- Relation (💞) and adoption (🍼) messages get their own notification type.
create or replace function public.notify_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_id uuid;
begin
  select case when pet_one_id = new.sender_pet_id then pet_two_id else pet_one_id end into other_id
  from public.pet_matches where id = new.match_id;
  if other_id is null then return new; end if;
  perform public.notify_pet(
    other_id,
    case
      when new.body like '📍%' then 'meeting'
      when new.body like '💞%' then 'relation'
      when new.body like '🍼%' then 'adoption'
      else 'message'
    end,
    new.sender_pet_id,
    jsonb_build_object('match_id', new.match_id, 'preview', left(new.body, 140))
  );
  return new;
end;
$$;

revoke execute on function public.notify_match() from public, anon, authenticated;
revoke execute on function public.notify_message() from public, anon, authenticated;

notify pgrst, 'reload schema';
