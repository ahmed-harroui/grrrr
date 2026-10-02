-- An account without a pet of its own (adopter mode, migration 015) stays anonymous when it waits
-- for a pet's babies: the 'adoption_interest' notification says "someone" instead of the family
-- name (data.anonymous, read by send-push and the app). Safe to run again. Run after 021.

create or replace function public.notify_adoption_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anonymous boolean;
begin
  select coalesce(adopter_only, false) into v_anonymous from public.pets where id = new.adopter_pet_id;
  perform public.notify_pet(
    new.pet_id,
    'adoption_interest',
    new.adopter_pet_id,
    jsonb_build_object('intent', coalesce(to_jsonb(new) ->> 'intent', 'ADOPT'), 'anonymous', coalesce(v_anonymous, false))
  );
  return new;
exception when others then
  raise warning 'adoption interest notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_adoption_interest() from public, anon, authenticated;

notify pgrst, 'reload schema';
