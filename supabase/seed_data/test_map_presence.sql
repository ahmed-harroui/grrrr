-- Test data for the Explore map (migration 028): the test bots are put on the map around
-- Bordeaux, so a real account that switches "Who sees me" on has friends (the bots it matched)
-- and district bubbles (the others) to look at. Safe to run again.
-- Their position is dated far ahead so it neither expires nor gets cleaned up.
-- To remove it: delete from public.pet_locations where pet_id in (select id from public.pets where is_bot);

insert into public.profiles (user_id, map_visibility)
select distinct owner_id, 'area' from public.pets where is_bot
on conflict (user_id) do update set map_visibility = 'area';

insert into public.pet_locations (pet_id, latitude, longitude, updated_at)
select id,
       round((44.8378 + (((row_number() over (order by id)) % 7) - 3) * 0.012)::numeric / 0.005) * 0.005,
       round((-0.5792 + (((row_number() over (order by id)) % 5) - 2) * 0.018)::numeric / 0.005) * 0.005,
       '2099-01-01'::timestamptz
from public.pets
where is_bot and not coalesce(adopter_only, false)
on conflict (pet_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, updated_at = excluded.updated_at;
