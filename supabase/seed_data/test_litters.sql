-- Test litters for Explore > Adopt: couples of test bots (a male and a female of the same
-- species) whose relationship is accepted, so the Adopt deck has cards to swipe.
-- Safe to run again. Real accounts see them; swiping "Adopt" sends the request to the two bots
-- (a conversation opens with each, like with a real litter).
-- To remove them: see the end of this file.

with males as (
  select id, species, row_number() over (partition by species order by pet_name, id) as rn
  from public.pets where is_bot and gender = 'M' and species in ('dog', 'cat') and coalesce(photo_url, '') <> ''
),
females as (
  select id, species, row_number() over (partition by species order by pet_name desc, id) as rn
  from public.pets where is_bot and gender = 'F' and species in ('dog', 'cat') and coalesce(photo_url, '') <> ''
),
couples as (
  select m.id as father, f.id as mother
  from males m join females f on f.species = m.species and f.rn = m.rn
  where (m.species = 'dog' and m.rn <= 4) or (m.species = 'cat' and m.rn <= 2)
),
matched as (
  insert into public.pet_matches (pet_one_id, pet_two_id, match_type)
  select least(father, mother), greatest(father, mother), 'BOTH' from couples
  on conflict (pet_one_id, pet_two_id) do nothing
  returning id
)
select count(*) as new_matches from matched;

insert into public.pet_litters (match_id, father_pet_id, mother_pet_id, proposer_pet_id, status, responded_at)
select pm.id, f.id, m.id, f.id, 'accepted', now()
from public.pet_matches pm
join public.pets f on f.id in (pm.pet_one_id, pm.pet_two_id) and f.is_bot and f.gender = 'M'
join public.pets m on m.id in (pm.pet_one_id, pm.pet_two_id) and m.is_bot and m.gender = 'F' and m.species = f.species
where pm.match_type = 'BOTH'
  and coalesce(f.photo_url, '') <> '' and coalesce(m.photo_url, '') <> ''
  and f.species in ('dog', 'cat')
on conflict (match_id) do update set status = 'accepted', responded_at = now(), updated_at = now();

select count(*) as test_litters_listed from public.pet_litters l
join public.pets f on f.id = l.father_pet_id
where f.is_bot and l.status = 'accepted';

-- Remove the test litters (and their adoption requests):
-- delete from public.pet_litters l using public.pets f, public.pets m
-- where f.id = l.father_pet_id and m.id = l.mother_pet_id and f.is_bot and m.is_bot;
