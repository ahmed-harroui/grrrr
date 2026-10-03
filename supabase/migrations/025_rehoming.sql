-- Pets to give away (website /adopt, "To give"). Safe to run again. Run after 024.
-- An owner who can no longer keep a pet posts it (photo in the pet-photos bucket); people
-- interested send a request with a message and a way to reach them, which only the owner reads.
-- Litters from matched couples stay in pet_litters (migration 012), with adopt or buy (016).

create table if not exists public.rehoming_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_name text not null check (char_length(pet_name) between 1 and 40),
  species text not null check (char_length(species) between 2 and 30),
  breed text not null default '' check (char_length(breed) <= 60),
  age text not null default '' check (char_length(age) <= 30),
  gender text not null default 'U' check (gender in ('M', 'F', 'U')),
  city text not null check (char_length(city) between 2 and 60),
  story text not null check (char_length(story) between 20 and 1200),
  photo_url text not null default '',
  vaccinated boolean not null default false,
  sterilized boolean not null default false,
  status text not null default 'open' check (status in ('open', 'reserved', 'adopted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rehoming_listings_status_idx on public.rehoming_listings (status, created_at desc);
create index if not exists rehoming_listings_owner_idx on public.rehoming_listings (owner_id);

alter table public.rehoming_listings enable row level security;

drop policy if exists "Open listings are public" on public.rehoming_listings;
create policy "Open listings are public" on public.rehoming_listings
  for select using (status in ('open', 'reserved') or owner_id = auth.uid());

drop policy if exists "Owners add listings" on public.rehoming_listings;
create policy "Owners add listings" on public.rehoming_listings
  for insert with check (owner_id = auth.uid());

drop policy if exists "Owners edit listings" on public.rehoming_listings;
create policy "Owners edit listings" on public.rehoming_listings
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners delete listings" on public.rehoming_listings;
create policy "Owners delete listings" on public.rehoming_listings
  for delete using (owner_id = auth.uid());

-- At most 5 open listings per account, against spam.
create or replace function public.rehoming_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.rehoming_listings where owner_id = new.owner_id and status in ('open', 'reserved')) >= 5 then
    raise exception 'LISTING_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists rehoming_listing_limit on public.rehoming_listings;
create trigger rehoming_listing_limit before insert on public.rehoming_listings
for each row execute function public.rehoming_listing_limit();

create table if not exists public.rehoming_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rehoming_listings(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 800),
  contact text not null check (char_length(contact) between 3 and 120),
  created_at timestamptz not null default now(),
  unique (listing_id, requester_id)
);

create index if not exists rehoming_requests_listing_idx on public.rehoming_requests (listing_id, created_at desc);

alter table public.rehoming_requests enable row level security;

drop policy if exists "Requesters and listing owners read requests" on public.rehoming_requests;
create policy "Requesters and listing owners read requests" on public.rehoming_requests
  for select using (
    requester_id = auth.uid()
    or exists (select 1 from public.rehoming_listings l where l.id = rehoming_requests.listing_id and l.owner_id = auth.uid())
  );

drop policy if exists "Members ask for an open listing" on public.rehoming_requests;
create policy "Members ask for an open listing" on public.rehoming_requests
  for insert with check (
    requester_id = auth.uid()
    and exists (select 1 from public.rehoming_listings l where l.id = listing_id and l.status = 'open' and l.owner_id <> auth.uid())
  );

drop policy if exists "Requesters withdraw their request" on public.rehoming_requests;
create policy "Requesters withdraw their request" on public.rehoming_requests
  for delete using (requester_id = auth.uid());

notify pgrst, 'reload schema';
