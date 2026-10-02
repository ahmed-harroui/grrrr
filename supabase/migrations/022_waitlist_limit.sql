-- At most 5 families waiting for a pet's babies. Safe to run again. Run after 021.
-- Anyone can swipe a pet up in Discover (adoption_interests): without a limit the owner would be
-- flooded. A pet holds 5 waiting families; the 6th swipe is refused (WAITLIST_FULL, the app says
-- so) until the owner removes one from the Matches tab, which they now may do.

create or replace function public.check_waitlist_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Two swipes at the same moment cannot both take the last place.
  perform pg_advisory_xact_lock(hashtext('waitlist:' || new.pet_id::text));
  if (select count(*) from public.adoption_interests where pet_id = new.pet_id) >= 5 then
    raise exception 'WAITLIST_FULL';
  end if;
  return new;
end;
$$;

drop trigger if exists adoption_interests_limit on public.adoption_interests;
create trigger adoption_interests_limit
before insert on public.adoption_interests
for each row execute function public.check_waitlist_limit();

revoke execute on function public.check_waitlist_limit() from public, anon, authenticated;

-- The owner may remove a waiting family (to make room, or simply to decline).
drop policy if exists "Pet owners can remove who waits for their pet" on public.adoption_interests;
create policy "Pet owners can remove who waits for their pet" on public.adoption_interests
  for delete using (exists (select 1 from public.pets where pets.id = adoption_interests.pet_id and pets.owner_id = auth.uid()));

notify pgrst, 'reload schema';
