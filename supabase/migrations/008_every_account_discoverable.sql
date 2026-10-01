-- Every account gets a Discover card.
-- 1. A profiles row is created at sign-up (it used to exist only after saving Settings).
-- 2. Each profile without a pet gets a starter pet (setup_pending = true), so it shows up in
--    Discover right away. The app sends that account to the pet setup screen, which fills
--    this same row instead of creating a second pet.
-- 3. Existing accounts are backfilled. Safe to run again.

alter table public.pets add column if not exists setup_pending boolean not null default false;

-- Starter pet for an account that has none yet.
create or replace function public.ensure_starter_pet(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  if p_user_id = 'b0770000-0000-4000-8000-000000000001' then return; end if; -- bot account
  if exists (select 1 from public.pets where owner_id = p_user_id) then return; end if;
  select nullif(trim(display_name), ''), nullif(trim(avatar_url), '')
    into v_name, v_avatar
    from public.profiles where user_id = p_user_id;
  insert into public.pets (owner_id, pet_name, species, bio, photo_url, setup_pending)
  values (p_user_id, coalesce(v_name, 'Nouveau compagnon'), 'dog', 'Nouveau sur GRRRR 🐾', coalesce(v_avatar, ''), true);
end;
$$;

-- profiles → starter pet
create or replace function public.trg_profile_starter_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_starter_pet(new.user_id);
  return new;
end;
$$;

drop trigger if exists profiles_starter_pet on public.profiles;
create trigger profiles_starter_pet
after insert on public.profiles
for each row execute function public.trg_profile_starter_pet();

-- auth.users → profiles (then the trigger above adds the starter pet)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.raw_user_meta_data ->> 'bot')::boolean, false) then return new; end if;
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
exception when others then
  -- Never block a sign-up because of this.
  raise notice 'Profile not created for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill: a profile for every existing account, then a starter pet for every profile without one.
insert into public.profiles (user_id)
select u.id from auth.users u
where u.id <> 'b0770000-0000-4000-8000-000000000001'
  and not coalesce((u.raw_user_meta_data ->> 'bot')::boolean, false)
on conflict (user_id) do nothing;

do $$
declare
  r record;
begin
  for r in select p.user_id from public.profiles p where not exists (select 1 from public.pets where owner_id = p.user_id) loop
    perform public.ensure_starter_pet(r.user_id);
  end loop;
end $$;

revoke execute on function public.ensure_starter_pet(uuid) from public, anon, authenticated;
revoke execute on function public.trg_profile_starter_pet() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Result shown in the SQL Editor: real accounts and how many already have a Discover card.
select
  (select count(*) from public.profiles) as profiles,
  (select count(distinct owner_id) from public.pets where not is_bot) as accounts_with_card,
  (select count(*) from public.pets where setup_pending) as starter_cards;
