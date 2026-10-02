-- Adoption XP. Safe to run again. Run after migration 012.
-- The adoption quest of migration 005 read a table that the app never filled. It now follows
-- the relation and adoption tables of migration 012, for both sides:
--   the one who gives: 200 XP while the pet has a litter listed in Adopt,
--                      20 XP per family that asked to adopt from it (up to 10);
--   the adopter:       40 XP per adoption request sent (up to 5).
-- Same function as in migration 005, with only the adoption part and the match count changed.

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
  adoption_sent integer := 0;
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

  -- Conversations opened by an adoption request are not matches: they count below, as adoption.
  select count(*) into match_count from public.pet_matches where p_pet_id in (pet_one_id, pet_two_id) and match_type <> 'ADOPT';
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

  -- Adoption (migration 012). The one who gives: the pet's listed litters and the families
  -- that asked to adopt from them. The adopter: the requests this pet's family sent.
  begin
    select count(*) filter (where l.status = 'accepted') into adoption_listings
      from public.pet_litters l where p_pet_id in (l.father_pet_id, l.mother_pet_id);
    select count(*) into adoption_babies
      from public.adoption_requests r join public.pet_litters l on l.id = r.litter_id
      where r.action = 'ADOPT' and p_pet_id in (l.father_pet_id, l.mother_pet_id);
    select count(*) into adoption_sent
      from public.adoption_requests r where r.adopter_pet_id = p_pet_id and r.action = 'ADOPT';
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
  xp_adoption := case when adoption_listings > 0 then 200 else 0 end + least(adoption_babies, 10) * 20 + least(adoption_sent, 5) * 40;

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
      jsonb_build_object('key', 'adoption', 'xp', xp_adoption, 'max', 600, 'count', adoption_babies + adoption_sent, 'goal', 15)
    )
  );
end;
$$;

revoke execute on function public.compute_pet_progress(uuid) from public, anon, authenticated;

-- A relation proposed, accepted or withdrawn: both parents' XP follows.
create or replace function public.trg_recompute_xp_litter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_pet_xp_safe(coalesce(new.father_pet_id, old.father_pet_id));
  perform public.recompute_pet_xp_safe(coalesce(new.mother_pet_id, old.mother_pet_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists pet_litters_recompute_xp on public.pet_litters;
create trigger pet_litters_recompute_xp
after insert or update or delete on public.pet_litters
for each row execute function public.trg_recompute_xp_litter();

-- An adoption request: the adopter's XP and both parents' XP follow.
create or replace function public.trg_recompute_xp_adoption_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  father_id uuid;
  mother_id uuid;
begin
  perform public.recompute_pet_xp_safe(coalesce(new.adopter_pet_id, old.adopter_pet_id));
  select father_pet_id, mother_pet_id into father_id, mother_id
  from public.pet_litters where id = coalesce(new.litter_id, old.litter_id);
  perform public.recompute_pet_xp_safe(father_id);
  perform public.recompute_pet_xp_safe(mother_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists adoption_requests_recompute_xp on public.adoption_requests;
create trigger adoption_requests_recompute_xp
after insert or update or delete on public.adoption_requests
for each row execute function public.trg_recompute_xp_adoption_request();

revoke execute on function public.trg_recompute_xp_litter() from public, anon, authenticated;
revoke execute on function public.trg_recompute_xp_adoption_request() from public, anon, authenticated;

-- What is already there counts now.
select public.recompute_pet_xp_safe(id) from public.pets;

notify pgrst, 'reload schema';
