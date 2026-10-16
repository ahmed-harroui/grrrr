-- Moderation of pet profiles. Safe to run again. Run after 028.
-- A pet whose name, photo or description breaks the rules (a person's name, an insult…) is hidden,
-- not its owner's account: out of Discover and trending (the read rule below), of others' likes and
-- matches, of the map and of the adoption feed. Its owner still sees it, gets a message saying why
-- and what to do, and the moment the name, photo, description or breed changes, it shows again and
-- comes back to the admin's review. Admin side: www.greatrascals.com/dashboard/moderation.

-- 1. Hidden, and why
alter table public.pets add column if not exists banned_at timestamptz;
alter table public.pets add column if not exists banned_reason text;
-- Changed by its owner since a ban: to look at again
alter table public.pets add column if not exists review_requested_at timestamptz;
alter table public.pets add column if not exists approved_at timestamptz; -- looked at by an admin: out of the review until its next change

-- 2. Other accounts never see a hidden pet (its owner does, through "Users can manage their own pets")
drop policy if exists "Authenticated users can discover pets" on public.pets;
create policy "Authenticated users can discover pets" on public.pets
  for select using (auth.uid() is not null and banned_at is null);

-- 3. The functions that read pets past that rule leave hidden ones out too
CREATE OR REPLACE FUNCTION public.get_adoption_feed(p_pet_id uuid)
 RETURNS TABLE(litter_id uuid, listed_at timestamp with time zone, litter_species text, father jsonb, mother jsonb, requests integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and f.banned_at is null and m.banned_at is null -- hidden pets (030)
      and f.owner_id <> auth.uid() and m.owner_id <> auth.uid()
      and not exists (select 1 from public.adoption_requests r where r.litter_id = l.id and r.adopter_pet_id = p_pet_id)
    order by coalesce(l.responded_at, l.created_at) desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_friends_on_map(p_pet_id uuid)
 RETURNS TABLE(pet_id uuid, pet_name text, photo_url text, species text, latitude double precision, longitude double precision, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, p.pet_name, p.photo_url, p.species, l.latitude, l.longitude, l.updated_at
    from public.pet_matches m
    join public.pets p on p.id = case when m.pet_one_id = p_pet_id then m.pet_two_id else m.pet_one_id end
    join public.pet_locations l on l.pet_id = p.id
    join public.profiles pr on pr.user_id = p.owner_id
    where p_pet_id in (m.pet_one_id, m.pet_two_id)
      and p.banned_at is null -- hidden pets (030)
      and m.match_type <> 'ADOPT'
      and pr.map_visibility in ('friends', 'area')
      and l.updated_at > now() - interval '6 hours';
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_bubbles(p_pet_id uuid, p_latitude double precision, p_longitude double precision)
 RETURNS TABLE(latitude double precision, longitude double precision, pets integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  return query
    select round(l.latitude / 0.02) * 0.02, round(l.longitude / 0.02) * 0.02, count(*)::integer
    from public.pet_locations l
    join public.pets p on p.id = l.pet_id
    join public.profiles pr on pr.user_id = p.owner_id
    where pr.map_visibility = 'area'
      and p.banned_at is null -- hidden pets (030)
      and p.owner_id <> auth.uid()
      and l.updated_at > now() - interval '24 hours'
      and l.latitude between p_latitude - 0.5 and p_latitude + 0.5
      and l.longitude between p_longitude - 0.7 and p_longitude + 0.7
      -- My matches are already shown one by one.
      and not exists (
        select 1 from public.pet_matches m
        where m.match_type <> 'ADOPT'
          and ((m.pet_one_id = p_pet_id and m.pet_two_id = l.pet_id) or (m.pet_two_id = p_pet_id and m.pet_one_id = l.pet_id))
      )
    group by 1, 2;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_pet_likers(p_pet_id uuid)
 RETURNS TABLE(id uuid, photo_url text, species text, liked_at timestamp with time zone, intent text, super_like boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.pets where pets.id = p_pet_id and owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, p.photo_url, p.species, s.created_at,
           coalesce(s.intent, case when p.mode >= 50 then 'HOT' else 'FRIEND' end),
           upper(s.action) = 'SUPER_LIKE'
    from public.pet_swipes s
    join public.pets p on p.id = s.from_pet_id
    where s.to_pet_id = p_pet_id
      and p.banned_at is null -- hidden pets (030)
      and upper(s.action) in ('LIKE', 'SUPER_LIKE')
      and not exists (select 1 from public.pet_swipes back where back.from_pet_id = p_pet_id and back.to_pet_id = s.from_pet_id)
      and not exists (select 1 from public.pet_matches m where m.pet_one_id = least(p_pet_id, s.from_pet_id) and m.pet_two_id = greatest(p_pet_id, s.from_pet_id))
    order by s.created_at desc;
end;
$function$;

-- 4. The owner fixes the profile: it shows again, and comes back to the admin's review
create or replace function public.pets_moderation_on_edit()
returns trigger
language plpgsql
as $$
begin
  if new.pet_name is distinct from old.pet_name or new.photo_url is distinct from old.photo_url
    or new.bio is distinct from old.bio or new.breed is distinct from old.breed then
    new.approved_at := null;
  end if;
  if old.banned_at is not null and (
    new.pet_name is distinct from old.pet_name or new.photo_url is distinct from old.photo_url
    or new.bio is distinct from old.bio or new.breed is distinct from old.breed
  ) then
    new.banned_at := null;
    new.review_requested_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists pets_moderation_on_edit on public.pets;
create trigger pets_moderation_on_edit before update on public.pets for each row execute function public.pets_moderation_on_edit();

-- 5. Words that put a profile at the top of the review (names of people, insults). Edit freely.
create table if not exists public.moderation_words (word text primary key, created_at timestamptz not null default now());
alter table public.moderation_words enable row level security;
insert into public.moderation_words (word) values ('ahmed'), ('hmida'), ('zab') on conflict do nothing;

-- 6. What the admin dashboard uses (service role only) ------------------------------------------
-- The pets to look at, one by one: p_mode = 'review' (changed after a ban, or with a flagged word),
-- 'all' (every real pet, newest first) or 'banned'.
create or replace function public.admin_pet_queue(p_mode text default 'review', p_limit integer default 300)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  with words as (select coalesce(string_agg(word, '|'), '^$') as pattern from public.moderation_words),
  pets as (
    select p.*, (select pattern from words) as pattern,
      (select u.created_at from auth.users u where u.id = p.owner_id) as owner_since,
      (select count(*) from public.pets o where o.owner_id = p.owner_id and not coalesce(o.setup_pending, false)) as owner_pets
    from public.pets p
    where not coalesce(p.is_bot, false) and not coalesce(p.setup_pending, false)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', pet_name, 'species', species, 'breed', breed, 'gender', gender, 'age', age, 'city', city, 'bio', bio,
      'photo', photo_url, 'photos', to_jsonb(photos), 'tags', to_jsonb(tags), 'createdAt', created_at,
      'ownerSince', owner_since, 'ownerPets', owner_pets, 'adopterOnly', coalesce(adopter_only, false),
      'bannedAt', banned_at, 'bannedReason', banned_reason, 'reviewRequestedAt', review_requested_at,
      'flagged', (coalesce(pet_name, '') || ' ' || coalesce(bio, '') || ' ' || coalesce(breed, '')) ~* ('\m(' || pattern || ')\M')
    ) order by
      (review_requested_at is not null) desc,
      ((coalesce(pet_name, '') || ' ' || coalesce(bio, '') || ' ' || coalesce(breed, '')) ~* ('\m(' || pattern || ')\M')) desc,
      created_at desc), '[]')
  from (
    select * from pets
    where case p_mode
      when 'banned' then banned_at is not null
      when 'review' then banned_at is null and (review_requested_at is not null or (approved_at is null and (coalesce(pet_name, '') || ' ' || coalesce(bio, '') || ' ' || coalesce(breed, '')) ~* ('\m(' || pattern || ')\M')))
      else true end
    order by created_at desc
    limit p_limit
  ) q
$$;

-- Hide a pet: out of Discover, likes, matches, the map and adoptions, and its owner is told why
create or replace function public.admin_ban_pet(p_pet_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet public.pets;
  v_why_fr text;
  v_why_en text;
begin
  update public.pets set banned_at = now(), banned_reason = p_reason, review_requested_at = null where id = p_pet_id returning * into v_pet;
  if v_pet.id is null then raise exception 'Pet not found'; end if;
  delete from public.pet_locations where pet_id = p_pet_id;
  v_why_fr := case p_reason
    when 'person_name' then 'Son nom est celui d''une personne : un compagnon doit avoir son propre nom.'
    when 'insult' then 'Son nom ou sa description contient un mot insultant ou déplacé.'
    when 'photo' then 'Sa photo ne montre pas un animal, ou n''est pas appropriée.'
    else 'Son profil ne respecte pas les règles de GRRRR.' end;
  v_why_en := case p_reason
    when 'person_name' then 'Its name is a person''s name: a companion needs a name of its own.'
    when 'insult' then 'Its name or description contains an insulting or inappropriate word.'
    when 'photo' then 'Its photo does not show an animal, or is not appropriate.'
    else 'Its profile does not follow the GRRRR rules.' end;
  perform public.notify_pet(p_pet_id, 'reminder', null, jsonb_build_object(
    'kind', 'moderation', 'icon', '⚠️', 'screen', 'pet',
    'titleFr', 'Le profil de ' || v_pet.pet_name || ' est masqué',
    'titleEn', v_pet.pet_name || '''s profile is hidden',
    'bodyFr', v_why_fr || ' Modifie son nom, sa photo ou sa description, ou crée un nouveau compagnon, pour réapparaître dans Découvrir.',
    'bodyEn', v_why_en || ' Change its name, photo or description, or create a new companion, to appear in Discover again.'));
  return jsonb_build_object('id', v_pet.id, 'bannedAt', v_pet.banned_at);
end;
$$;

-- Show it again (a mistake, or after checking the owner's changes)
create or replace function public.admin_unban_pet(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet public.pets;
begin
  update public.pets set banned_at = null, banned_reason = null, review_requested_at = null where id = p_pet_id returning * into v_pet;
  if v_pet.id is null then raise exception 'Pet not found'; end if;
  return jsonb_build_object('id', v_pet.id);
end;
$$;

-- Looked at and fine: out of the review
create or replace function public.admin_approve_pet(p_pet_id uuid)
returns void
language sql
security definer
set search_path = public
as $$ update public.pets set review_requested_at = null, approved_at = now() where id = p_pet_id $$;

revoke execute on function public.admin_pet_queue(text, integer) from public, anon, authenticated;
revoke execute on function public.admin_ban_pet(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_unban_pet(uuid) from public, anon, authenticated;
revoke execute on function public.admin_approve_pet(uuid) from public, anon, authenticated;
grant execute on function public.admin_pet_queue(text, integer) to service_role;
grant execute on function public.admin_ban_pet(uuid, text) to service_role;
grant execute on function public.admin_unban_pet(uuid) to service_role;
grant execute on function public.admin_approve_pet(uuid) to service_role;

notify pgrst, 'reload schema';
