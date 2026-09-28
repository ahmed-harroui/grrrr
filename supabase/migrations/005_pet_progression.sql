-- Pet progression: XP and level are computed on the server from real activity,
-- so they can't be edited from the app. Levels are meant to be hard to reach.
-- Triggers at the bottom recompute a pet's XP as soon as something that counts changes
-- (in GRRRR or in GRRRR Care). Safe to run again.

-- One row per pet per week the owner opened the app (weekly connection streak).
create table if not exists public.pet_weekly_visits (
  pet_id uuid not null references public.pets(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (pet_id, week_start)
);

alter table public.pet_weekly_visits enable row level security;
drop policy if exists "Owners can read their pet weekly visits" on public.pet_weekly_visits;
create policy "Owners can read their pet weekly visits" on public.pet_weekly_visits
  for select using (exists (select 1 from public.pets where pets.id = pet_weekly_visits.pet_id and pets.owner_id = auth.uid()));

-- XP needed for levels 2..6 (level 1 starts at 0).
create or replace function public.pet_level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select case
    when p_xp >= 14000 then 6
    when p_xp >= 8000 then 5
    when p_xp >= 4000 then 4
    when p_xp >= 1800 then 3
    when p_xp >= 600 then 2
    else 1
  end;
$$;

-- Internal: recomputes a pet's XP from everything it has done, stores xp/level on the pet
-- and returns the detail per source. No permission check — only called by
-- refresh_pet_progress (owner-checked) and by the triggers below.
create or replace function public.compute_pet_progress(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pet public.pets;
  week date := date_trunc('week', now())::date;
  profile_items integer;
  gallery_count integer;
  match_count integer;
  likes_received integer;
  messages_sent integer;
  messages_received integer;
  meetings_done integer;
  weeks_total integer;
  weeks_streak integer;
  vaccination_count integer := 0;
  vet_visit_count integer := 0;
  document_count integer := 0;
  has_microchip boolean;
  has_weight boolean;
  care_linked boolean;
  adoption_listings integer := 0;
  adoption_babies integer := 0;
  xp_profile integer;
  xp_gallery integer;
  xp_matches integer;
  xp_likes integer;
  xp_messages integer;
  xp_meetings integer;
  xp_weekly integer;
  xp_treats integer;
  xp_care integer;
  xp_adoption integer;
  total integer;
  new_level integer;
begin
  select * into pet from public.pets where id = p_pet_id;
  if pet.id is null then return null; end if;

  -- Profile filled to the max: 9 items, and a bonus only when everything is there.
  profile_items :=
    (coalesce(pet.pet_name, '') <> '')::int + (coalesce(pet.breed, '') <> '')::int + (coalesce(pet.age, 0) > 0)::int
    + (coalesce(pet.city, '') <> '')::int + (char_length(coalesce(pet.bio, '')) >= 40)::int + (coalesce(pet.photo_url, '') <> '')::int
    + (cardinality(coalesce(pet.tags, '{}')) >= 3)::int + (pet.gender is not null)::int + (cardinality(coalesce(pet.photos, '{}')) >= 3)::int;
  gallery_count := least(cardinality(coalesce(pet.photos, '{}')), 6);

  select count(*) into match_count from public.pet_matches where p_pet_id in (pet_one_id, pet_two_id);
  select count(*) into likes_received from public.pet_swipes where to_pet_id = p_pet_id and upper(action) in ('LIKE', 'SUPER_LIKE');
  select count(*) filter (where m.sender_pet_id = p_pet_id), count(*) filter (where m.sender_pet_id <> p_pet_id)
    into messages_sent, messages_received
    from public.match_messages m join public.pet_matches pm on pm.id = m.match_id
    where p_pet_id in (pm.pet_one_id, pm.pet_two_id);
  select count(*) into meetings_done
    from public.meeting_proposals mp join public.pet_matches pm on pm.id = mp.match_id
    where mp.status = 'completed' and p_pet_id in (pm.pet_one_id, pm.pet_two_id);

  -- Weekly streak: consecutive weeks up to this one.
  select count(*) into weeks_total from public.pet_weekly_visits where pet_id = p_pet_id;
  select count(*) into weeks_streak from (
    select week_start, row_number() over (order by week_start desc) as rn
    from public.pet_weekly_visits where pet_id = p_pet_id
  ) w where w.week_start = week - ((w.rn - 1) * 7)::int;

  -- GRRRR Care data (tables shared with the Care app).
  begin
    select count(*) into vaccination_count from public.vaccinations where pet_id = p_pet_id;
    select count(*) into vet_visit_count from public.vet_visits where pet_id = p_pet_id;
    select count(*) into document_count from public.pet_documents where pet_id = p_pet_id;
  exception when undefined_table then null;
  end;
  has_microchip := coalesce(to_jsonb(pet) ->> 'microchip', '') <> '';
  has_weight := coalesce(to_jsonb(pet) ->> 'weight', '') <> '';
  care_linked := vaccination_count + vet_visit_count + document_count > 0 or has_microchip or has_weight;

  -- Adoption (babies offered for adoption). The babies column may not exist yet:
  -- read it through jsonb, 1 baby per listing otherwise.
  begin
    select count(*), coalesce(sum(coalesce(nullif(to_jsonb(al) ->> 'babies_count', '')::int, 1)), 0)
      into adoption_listings, adoption_babies
      from public.adoption_listings al where al.pet_id = p_pet_id;
  exception when undefined_table then null;
  end;

  xp_profile := profile_items * 20 + case when profile_items = 9 then 120 else 0 end;
  xp_gallery := gallery_count * 10;
  xp_matches := least(match_count, 60) * 25;
  xp_likes := least(likes_received, 500) * 4;
  xp_messages := least(messages_sent, 1000) + least(messages_received, 500) * 2;
  xp_meetings := meetings_done * 80;
  xp_weekly := weeks_total * 15 + least(weeks_streak, 12) * least(weeks_streak, 12) * 5;
  xp_treats := coalesce(pet.treats, 0);
  xp_care := case when care_linked then 150 else 0 end
    + least(vaccination_count, 10) * 20 + least(vet_visit_count, 10) * 30 + least(document_count, 5) * 15
    + case when has_microchip then 50 else 0 end + case when has_weight then 30 else 0 end;
  xp_adoption := case when adoption_listings > 0 then 200 else 0 end + least(adoption_babies, 10) * 20;

  total := xp_profile + xp_gallery + xp_matches + xp_likes + xp_messages + xp_meetings + xp_weekly + xp_treats + xp_care + xp_adoption;
  new_level := public.pet_level_for_xp(total);

  update public.pets set xp = total, level = new_level where id = p_pet_id and (xp is distinct from total or level is distinct from new_level);

  return jsonb_build_object(
    'xp', total,
    'level', new_level,
    'weeks_streak', weeks_streak,
    'care_linked', care_linked,
    'sources', jsonb_build_array(
      jsonb_build_object('key', 'profile', 'xp', xp_profile, 'max', 300, 'count', profile_items, 'goal', 9),
      jsonb_build_object('key', 'gallery', 'xp', xp_gallery, 'max', 60, 'count', gallery_count, 'goal', 6),
      jsonb_build_object('key', 'matches', 'xp', xp_matches, 'max', 1500, 'count', match_count, 'goal', 60),
      jsonb_build_object('key', 'likes', 'xp', xp_likes, 'max', 2000, 'count', likes_received, 'goal', 500),
      jsonb_build_object('key', 'messages', 'xp', xp_messages, 'max', 2000, 'count', messages_sent + messages_received, 'goal', 1500),
      jsonb_build_object('key', 'meetings', 'xp', xp_meetings, 'max', null, 'count', meetings_done, 'goal', null),
      jsonb_build_object('key', 'weekly', 'xp', xp_weekly, 'max', null, 'count', weeks_streak, 'goal', 12),
      jsonb_build_object('key', 'treats', 'xp', xp_treats, 'max', null, 'count', coalesce(pet.treats, 0), 'goal', null),
      jsonb_build_object('key', 'care', 'xp', xp_care, 'max', 1080, 'count', vaccination_count + vet_visit_count + document_count, 'goal', 25),
      jsonb_build_object('key', 'adoption', 'xp', xp_adoption, 'max', 400, 'count', adoption_babies, 'goal', 10)
    )
  );
end;
$$;

revoke execute on function public.compute_pet_progress(uuid) from public, anon, authenticated;

-- Called by the app: owner check, records this week's visit, returns the detail.
create or replace function public.refresh_pet_progress(p_pet_id uuid, p_visit boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  if p_visit then
    insert into public.pet_weekly_visits (pet_id, week_start) values (p_pet_id, date_trunc('week', now())::date) on conflict do nothing;
  end if;
  return public.compute_pet_progress(p_pet_id);
end;
$$;

grant execute on function public.refresh_pet_progress(uuid, boolean) to authenticated;

-- Treats no longer add XP directly: XP is always recomputed from real activity.
create or replace function public.award_treats(p_pet_id uuid, p_amount integer, p_reason text, p_context_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_balance integer;
begin
  if current_user_id is null or p_amount <= 0 then
    return null;
  end if;

  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = current_user_id) then
    return null;
  end if;

  insert into public.treat_events (pet_id, reason, context_key, amount)
  values (p_pet_id, p_reason, p_context_key, p_amount)
  on conflict (pet_id, context_key) do nothing;

  if found then
    update public.pets
    set treats = treats + p_amount,
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

-- ---------------------------------------------------------------------------
-- Automatic recompute: as soon as something that earns XP changes.
-- A failure here never blocks the user's action.
-- ---------------------------------------------------------------------------

create or replace function public.recompute_pet_xp_safe(p_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pet_id is not null then
    perform public.compute_pet_progress(p_pet_id);
  end if;
exception when others then
  raise warning 'XP recompute failed for pet %: %', p_pet_id, sqlerrm;
end;
$$;

-- Tables whose rows carry a pet_id (Care data, adoption).
create or replace function public.trg_recompute_xp_pet_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_pet_xp_safe(coalesce(new.pet_id, old.pet_id));
  return coalesce(new, old);
end;
$$;

-- The pet itself: profile fields, photos, treats, Care fields.
create or replace function public.trg_recompute_xp_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_pet_xp_safe(new.id);
  return new;
end;
$$;

-- A like (or super like) received.
create or replace function public.trg_recompute_xp_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_pet_xp_safe(new.to_pet_id);
  return new;
end;
$$;

-- A new match: both pets.
create or replace function public.trg_recompute_xp_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_pet_xp_safe(new.pet_one_id);
  perform public.recompute_pet_xp_safe(new.pet_two_id);
  return new;
end;
$$;

-- Messages and meetings belong to a match: both pets of that match.
create or replace function public.trg_recompute_xp_match_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  one_id uuid;
  two_id uuid;
begin
  select pet_one_id, pet_two_id into one_id, two_id from public.pet_matches where id = new.match_id;
  perform public.recompute_pet_xp_safe(one_id);
  perform public.recompute_pet_xp_safe(two_id);
  return new;
end;
$$;

-- "update of" lists only the columns that earn XP, so the xp/level update itself doesn't loop.
drop trigger if exists pets_recompute_xp on public.pets;
create trigger pets_recompute_xp
after insert or update of pet_name, breed, age, city, bio, photo_url, tags, gender, photos, treats, weight, microchip on public.pets
for each row execute function public.trg_recompute_xp_pet();

drop trigger if exists pet_swipes_recompute_xp on public.pet_swipes;
create trigger pet_swipes_recompute_xp
after insert or update of action on public.pet_swipes
for each row execute function public.trg_recompute_xp_swipe();

drop trigger if exists pet_matches_recompute_xp on public.pet_matches;
create trigger pet_matches_recompute_xp
after insert on public.pet_matches
for each row execute function public.trg_recompute_xp_match();

drop trigger if exists match_messages_recompute_xp on public.match_messages;
create trigger match_messages_recompute_xp
after insert on public.match_messages
for each row execute function public.trg_recompute_xp_match_child();

drop trigger if exists meeting_proposals_recompute_xp on public.meeting_proposals;
create trigger meeting_proposals_recompute_xp
after update of status on public.meeting_proposals
for each row execute function public.trg_recompute_xp_match_child();

-- Care and adoption tables (only if they exist).
do $$
declare
  t text;
begin
  foreach t in array array['vaccinations', 'vet_visits', 'medications', 'pet_documents', 'adoption_listings'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_recompute_xp', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.trg_recompute_xp_pet_id()', t || '_recompute_xp', t);
    end if;
  end loop;
end $$;

-- Internal helpers: only the database (triggers) may call them, not the API.
revoke execute on function public.recompute_pet_xp_safe(uuid) from public, anon, authenticated;
revoke execute on function public.trg_recompute_xp_pet_id() from public, anon, authenticated;
revoke execute on function public.trg_recompute_xp_pet() from public, anon, authenticated;
revoke execute on function public.trg_recompute_xp_swipe() from public, anon, authenticated;
revoke execute on function public.trg_recompute_xp_match() from public, anon, authenticated;
revoke execute on function public.trg_recompute_xp_match_child() from public, anon, authenticated;

-- Recompute every existing pet once, so what was already done (photos, profile, matches...) counts now.
select public.recompute_pet_xp_safe(id) from public.pets;

notify pgrst, 'reload schema';
