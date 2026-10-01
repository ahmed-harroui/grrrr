-- Test likes: 8 bot pets like each pet of one account, so the blurred "liked you" row
-- on the Matches screen has something to show. Run in the Supabase SQL Editor
-- (needs migrations 006 and 009). Safe to run again: it only adds likes from bots
-- your pet has not swiped or matched yet.

do $$
declare
  target_email text := 'harrouiahmed001@gmail.com'; -- account that receives the likes
  my_pet record;
  added integer;
begin
  for my_pet in
    select p.id, p.pet_name
    from public.pets p
    join auth.users u on u.id = p.owner_id
    where lower(u.email) = lower(target_email) and not p.is_bot
  loop
    with picked as (
      select b.id, row_number() over (order by b.id) as n
      from public.pets b
      where b.is_bot
        and not exists (
          select 1 from public.pet_swipes s
          where (s.from_pet_id = b.id and s.to_pet_id = my_pet.id) or (s.from_pet_id = my_pet.id and s.to_pet_id = b.id)
        )
        and not exists (
          select 1 from public.pet_matches m
          where m.pet_one_id = least(b.id, my_pet.id) and m.pet_two_id = greatest(b.id, my_pet.id)
        )
      limit 8
    )
    -- A mix of Hot and Friend likes, with one super like.
    insert into public.pet_swipes (from_pet_id, to_pet_id, action, intent)
    select id, my_pet.id, case when n = 1 then 'SUPER_LIKE' else 'LIKE' end, case when n % 2 = 1 then 'HOT' else 'FRIEND' end
    from picked
    on conflict (from_pet_id, to_pet_id) do nothing;
    get diagnostics added = row_count;
    raise notice '% likes added for %', added, my_pet.pet_name;
  end loop;
end $$;

-- Result: pending likes per pet of the account.
select p.pet_name, count(*) as likes_received
from public.pet_swipes s
join public.pets p on p.id = s.to_pet_id
where not p.is_bot and upper(s.action) in ('LIKE', 'SUPER_LIKE')
group by p.pet_name;
