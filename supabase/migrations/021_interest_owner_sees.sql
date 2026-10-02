-- The owner sees who waits for their pet's babies. Safe to run again. Run after 016.
-- A swipe up in Discover (adoption_interests, migration 015) is no longer hidden from the pet's
-- owner: they can read it (Matches tab, under the likes) and are told right away
-- (notification 'adoption_interest', with "adopt" or "buy").

drop policy if exists "Pet owners can read who waits for their pet" on public.adoption_interests;
create policy "Pet owners can read who waits for their pet" on public.adoption_interests
  for select using (exists (select 1 from public.pets where pets.id = adoption_interests.pet_id and pets.owner_id = auth.uid()));

create or replace function public.notify_adoption_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_pet(new.pet_id, 'adoption_interest', new.adopter_pet_id, jsonb_build_object('intent', coalesce(to_jsonb(new) ->> 'intent', 'ADOPT')));
  return new;
exception when others then
  -- Never block the swipe itself.
  raise warning 'Adoption interest not notified: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists adoption_interests_notify on public.adoption_interests;
create trigger adoption_interests_notify
after insert on public.adoption_interests
for each row execute function public.notify_adoption_interest();

revoke execute on function public.notify_adoption_interest() from public, anon, authenticated;

notify pgrst, 'reload schema';
