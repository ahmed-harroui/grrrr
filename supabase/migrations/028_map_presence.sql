-- Who is around on the Explore map. Safe to run again. Run after 027.
-- Privacy first: nothing is shared unless the owner switches it on (profiles.map_visibility),
-- the position kept is already rounded (never the exact spot), it is only read through the two
-- functions below, and it disappears after a day without the app.
--   'off'     (default) not on the map
--   'friends' my matches see my pet, to about 500 m
--   'area'    my matches see my pet, and everyone else sees only a count per district (~2 km)

alter table public.profiles add column if not exists map_visibility text not null default 'off';
alter table public.profiles drop constraint if exists profiles_map_visibility_check;
alter table public.profiles add constraint profiles_map_visibility_check check (map_visibility in ('off', 'friends', 'area'));

create table if not exists public.pet_locations (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  -- Rounded to 0.005° (about 500 m) before it is stored
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);

create index if not exists pet_locations_updated_idx on public.pet_locations (updated_at);

-- No policy: the table is only reached through the security definer functions.
alter table public.pet_locations enable row level security;

-- My pet's position, sent by the app while the map is open. Ignored (and erased) when the
-- account is not shown on the map.
create or replace function public.update_my_location(p_pet_id uuid, p_latitude double precision, p_longitude double precision)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visibility text;
begin
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  select coalesce(map_visibility, 'off') into v_visibility from public.profiles where user_id = auth.uid();
  if coalesce(v_visibility, 'off') = 'off' or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    delete from public.pet_locations where pet_id in (select id from public.pets where owner_id = auth.uid());
    return false;
  end if;
  insert into public.pet_locations (pet_id, latitude, longitude, updated_at)
  values (p_pet_id, round(p_latitude / 0.005) * 0.005, round(p_longitude / 0.005) * 0.005, now())
  on conflict (pet_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, updated_at = now();
  -- One pet per account on the map: the one in use.
  delete from public.pet_locations where pet_id <> p_pet_id and pet_id in (select id from public.pets where owner_id = auth.uid());
  return true;
end;
$$;

-- Choosing who sees me; switching off erases my position at once.
create or replace function public.set_map_visibility(p_visibility text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := case when p_visibility in ('friends', 'area') then p_visibility else 'off' end;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.profiles (user_id, map_visibility) values (auth.uid(), v)
  on conflict (user_id) do update set map_visibility = excluded.map_visibility;
  if v = 'off' then
    delete from public.pet_locations where pet_id in (select id from public.pets where owner_id = auth.uid());
  end if;
  return v;
end;
$$;

-- My pet's matches who are on the map and were active in the last 6 hours.
create or replace function public.get_friends_on_map(p_pet_id uuid)
returns table (pet_id uuid, pet_name text, photo_url text, species text, latitude double precision, longitude double precision, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
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
      and m.match_type <> 'ADOPT'
      and pr.map_visibility in ('friends', 'area')
      and l.updated_at > now() - interval '6 hours';
end;
$$;

-- Everyone else: only how many pets per district (cells of 0.02°, about 2 km), never who.
create or replace function public.get_map_bubbles(p_pet_id uuid, p_latitude double precision, p_longitude double precision)
returns table (latitude double precision, longitude double precision, pets integer)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke execute on function public.update_my_location(uuid, double precision, double precision) from public, anon;
revoke execute on function public.set_map_visibility(text) from public, anon;
revoke execute on function public.get_friends_on_map(uuid) from public, anon;
revoke execute on function public.get_map_bubbles(uuid, double precision, double precision) from public, anon;
grant execute on function public.update_my_location(uuid, double precision, double precision) to authenticated;
grant execute on function public.set_map_visibility(text) to authenticated;
grant execute on function public.get_friends_on_map(uuid) to authenticated;
grant execute on function public.get_map_bubbles(uuid, double precision, double precision) to authenticated;

-- Positions older than a day are erased (every hour).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('grrrr-map-cleanup') where exists (select 1 from cron.job where jobname = 'grrrr-map-cleanup');
    perform cron.schedule('grrrr-map-cleanup', '17 * * * *', $job$delete from public.pet_locations where updated_at < now() - interval '24 hours'$job$);
  end if;
end $$;

notify pgrst, 'reload schema';
