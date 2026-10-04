-- The owner of a pet to give is told when someone asks for it. Safe to run again. Run after 025.
-- Requests are sent on the website (rehoming_requests): the owner gets a notification in GRRRR
-- (and the push that goes with it), on their first pet, with a link to their listings. An owner
-- with no pet in the app sees the request on the website (/adopt/mine).

create or replace function public.notify_rehoming_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing public.rehoming_listings;
  v_pet uuid;
begin
  select * into listing from public.rehoming_listings where id = new.listing_id;
  if not found then return new; end if;
  select id into v_pet from public.pets where owner_id = listing.owner_id order by coalesce(adopter_only, false), created_at limit 1;
  if v_pet is null then return new; end if;
  perform public.notify_pet(v_pet, 'news', null, jsonb_build_object(
    'titleFr', '🏡 Quelqu''un aimerait accueillir ' || listing.pet_name,
    'titleEn', '🏡 Someone would love to welcome ' || listing.pet_name,
    'bodyFr', 'Une nouvelle demande t''attend : lis son message et sa façon de te joindre.',
    'bodyEn', 'A new request is waiting: read their message and how to reach them.',
    'url', 'https://grrrr-main.vercel.app/adopt/mine'
  ));
  return new;
exception when others then
  -- Never block the request itself.
  raise warning 'Rehoming request not notified: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists rehoming_requests_notify on public.rehoming_requests;
create trigger rehoming_requests_notify
after insert on public.rehoming_requests
for each row execute function public.notify_rehoming_request();

revoke execute on function public.notify_rehoming_request() from public, anon, authenticated;
