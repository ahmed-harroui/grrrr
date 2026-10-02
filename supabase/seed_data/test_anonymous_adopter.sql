-- Test data: an account with no pet of its own (adopter mode) waiting for the babies of each real
-- account's pet named Luna, to see how Matches shows it (no name, "Wants to adopt", migration 024).
-- The adopter is a test bot (is_bot), owned by the same bot account as Bruno. Safe to run again.
-- To remove it: delete from public.pets where is_bot and adopter_only and pet_name = 'Famille Test';

with adopter as (
  insert into public.pets (owner_id, pet_name, species, breed, bio, photo_url, adopter_only, is_bot, setup_pending)
  select owner_id, 'Famille Test', 'dog', '', '', '', true, true, false
  from public.pets
  where is_bot and pet_name = 'Bruno'
    and not exists (select 1 from public.pets where is_bot and adopter_only and pet_name = 'Famille Test')
  limit 1
  returning id
),
adopter_id as (
  select id from adopter
  union all
  select id from public.pets where is_bot and adopter_only and pet_name = 'Famille Test'
  limit 1
)
insert into public.adoption_interests (pet_id, adopter_pet_id, intent)
select luna.id, adopter_id.id, 'ADOPT'
from public.pets luna, adopter_id
where luna.pet_name = 'Luna' and not luna.is_bot and not coalesce(luna.adopter_only, false)
on conflict do nothing;
