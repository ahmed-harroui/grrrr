-- Levels leave the app: they become a hidden ranking signal (Discover, trending) that only the
-- admins see, on www.greatrascals.com/dashboard. Safe to run again. Run after 031.
-- XP and level are still computed exactly as before (migrations 005 and 013).

-- 1. No more "X passe niveau 3" notifications or pushes, and the old ones leave the inbox
drop trigger if exists pets_notify_level_up on public.pets;
drop function if exists public.notify_level_up();
delete from public.notifications where type = 'level_up';

-- 2. What the admin dashboard shows (service role only) ----------------------------------------
-- Real pets per level (1..6) and the 25 with the most XP.
create or replace function public.admin_pet_levels()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with real as (
    select id, pet_name, species, photo_url, city, xp, level, banned_at
    from public.pets
    where not coalesce(is_bot, false) and not coalesce(setup_pending, false)
  )
  select jsonb_build_object(
    'levels', (
      select jsonb_agg(jsonb_build_object('level', l, 'pets', (select count(*) from real where coalesce(real.level, 1) = l)) order by l)
      from generate_series(1, 6) l
    ),
    'averageXp', (select coalesce(round(avg(coalesce(xp, 0))), 0) from real),
    'top', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'name', pet_name, 'species', species, 'photo', photo_url, 'city', city,
          'xp', coalesce(xp, 0), 'level', coalesce(level, 1), 'hidden', banned_at is not null
        ) order by coalesce(xp, 0) desc, coalesce(level, 1) desc), '[]')
      from (select * from real order by coalesce(xp, 0) desc, coalesce(level, 1) desc limit 25) t
    )
  )
$$;

revoke execute on function public.admin_pet_levels() from public, anon, authenticated;
grant execute on function public.admin_pet_levels() to service_role;
