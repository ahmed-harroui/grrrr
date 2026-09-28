-- One-sided likes + live match alerts. Safe to run again.

-- Pets that liked my pet and that my pet hasn't answered yet (no swipe back, no match).
-- Only the owner of p_pet_id can ask. The app shows them blurred: it's not a match yet.
create or replace function public.get_pet_likers(p_pet_id uuid)
returns table (id uuid, photo_url text, species text, liked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.pets where pets.id = p_pet_id and owner_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, p.photo_url, p.species, s.created_at
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

-- Live "It's a Match": stream new matches to the app (RLS: only the two owners receive them).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pet_matches'
  ) then
    alter publication supabase_realtime add table public.pet_matches;
  end if;
end $$;

notify pgrst, 'reload schema';
