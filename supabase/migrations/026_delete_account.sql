-- Delete my account (GRRRR, GRR Care and the website). Safe to run again. Run after 025.
-- Google Play and the GDPR both ask for it: the signed-in member removes their own account from
-- inside the app. Everything tied to it goes with it through the foreign keys (profile, pets and
-- their swipes, matches, messages and health records, push tokens, streaks, threads, listings).
-- The caller empties its own Storage folders first (pet-photos/<id>/…, pet-documents/<id>/…):
-- files are removed through the Storage API, not from SQL.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
