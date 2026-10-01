-- Hot / Friend likes. Safe to run again.
-- A like stores the mood it was sent in (HOT or FRIEND). The liked pet sees it blurred with
-- that mood; it only becomes a match when it likes back in Discover, and the match type
-- comes from both likes: HOT + HOT = LOVE, FRIEND + FRIEND = FRIEND, mixed = BOTH.

alter table public.pet_swipes add column if not exists intent text;
alter table public.pet_swipes drop constraint if exists pet_swipes_intent_check;
alter table public.pet_swipes add constraint pet_swipes_intent_check check (intent is null or intent in ('HOT', 'FRIEND'));

-- The match type follows the two likes' moods.
create or replace function public.create_reciprocal_pet_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  back_intent text;
begin
  if new.action not in ('LIKE', 'SUPER_LIKE') then return new; end if;
  select intent into back_intent from public.pet_swipes
  where from_pet_id = new.to_pet_id and to_pet_id = new.from_pet_id and action in ('LIKE', 'SUPER_LIKE');
  if not found then return new; end if;
  insert into public.pet_matches (pet_one_id, pet_two_id, match_type)
  values (
    least(new.from_pet_id, new.to_pet_id),
    greatest(new.from_pet_id, new.to_pet_id),
    case
      when new.intent = 'HOT' and back_intent = 'HOT' then 'LOVE'
      when new.intent = 'FRIEND' and back_intent = 'FRIEND' then 'FRIEND'
      else 'BOTH'
    end
  )
  on conflict (pet_one_id, pet_two_id) do nothing;
  return new;
end;
$$;

-- Test bots like back in the same mood, so testing a Hot like gives a Hot match.
create or replace function public.bot_like_back()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(new.action) in ('LIKE', 'SUPER_LIKE')
     and exists (select 1 from public.pets where id = new.to_pet_id and is_bot)
     and not exists (select 1 from public.pets where id = new.from_pet_id and is_bot) then
    insert into public.pet_swipes (from_pet_id, to_pet_id, action, intent)
    values (new.to_pet_id, new.from_pet_id, 'LIKE', new.intent)
    on conflict (from_pet_id, to_pet_id) do update set action = 'LIKE', intent = excluded.intent;
  end if;
  return new;
end;
$$;

-- Pending likes now also say their mood and whether it was a super like.
drop function if exists public.get_pet_likers(uuid);
create function public.get_pet_likers(p_pet_id uuid)
returns table (id uuid, photo_url text, species text, liked_at timestamptz, intent text, super_like boolean)
language plpgsql
security definer
set search_path = public
as $$
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
      and upper(s.action) in ('LIKE', 'SUPER_LIKE')
      and not exists (select 1 from public.pet_swipes back where back.from_pet_id = p_pet_id and back.to_pet_id = s.from_pet_id)
      and not exists (select 1 from public.pet_matches m where m.pet_one_id = least(p_pet_id, s.from_pet_id) and m.pet_two_id = greatest(p_pet_id, s.from_pet_id))
    order by s.created_at desc;
end;
$$;

revoke execute on function public.get_pet_likers(uuid) from public, anon;
grant execute on function public.get_pet_likers(uuid) to authenticated;

notify pgrst, 'reload schema';
