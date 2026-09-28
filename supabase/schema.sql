create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop column if exists treats;
alter table public.profiles drop column if exists pet_name;
alter table public.profiles drop column if exists breed;
alter table public.profiles drop column if exists age;
alter table public.profiles drop column if exists city;
alter table public.profiles drop column if exists bio;
alter table public.profiles drop column if exists energy;
alter table public.profiles drop column if exists mode;
alter table public.profiles drop column if exists photo_url;

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_name text not null,
  species text not null,
  breed text not null default '',
  age integer not null default 0 check (age between 0 and 80),
  city text not null default '',
  bio text not null default '',
  energy smallint not null default 3 check (energy between 1 and 4),
  mode integer not null default 50 check (mode between 0 and 100),
  photo_url text not null default '',
  tags text[] not null default '{}',
  gender text,
  treats integer not null default 0 check (treats >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pets enable row level security;
alter table public.pets add column if not exists treats integer not null default 0;
alter table public.pets add column if not exists matches_count integer not null default 0;
alter table public.pets add column if not exists outings_count integer not null default 0;
alter table public.pets add column if not exists messages_received integer not null default 0;
alter table public.pets add column if not exists sessions_count integer not null default 0;
alter table public.pets add column if not exists level integer not null default 1;
alter table public.pets add column if not exists xp integer not null default 0;
-- Gallery pictures (photo_url is the avatar). Storage bucket: migrations/003_pet_photos.sql
alter table public.pets add column if not exists photos text[] not null default '{}';
create policy "Users can manage their own pets" on public.pets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Authenticated users can discover pets" on public.pets;
create policy "Authenticated users can discover pets" on public.pets
  for select using (auth.uid() is not null);

create table if not exists public.treat_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  reason text not null check (reason in ('match', 'outing')),
  context_key text not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (pet_id, context_key)
);

alter table public.treat_events add column if not exists pet_id uuid references public.pets(id) on delete cascade;
alter table public.treat_events drop column if exists owner_id;
alter table public.treat_events drop constraint if exists treat_events_owner_id_context_key_key;
alter table public.treat_events drop constraint if exists treat_events_pet_id_context_key_key;
alter table public.treat_events add constraint treat_events_pet_id_context_key_key unique (pet_id, context_key);

alter table public.treat_events enable row level security;
drop policy if exists "Users can view their own treat events" on public.treat_events;
create policy "Users can view their own pet treat events" on public.treat_events
  for select using (exists (select 1 from public.pets where pets.id = treat_events.pet_id and pets.owner_id = auth.uid()));

create table if not exists public.meeting_traces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_key text not null,
  matched_pet_key text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  marker text not null check (marker in ('pink', 'blue')),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  requested_by text not null default 'me' check (requested_by in ('me', 'them')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, pet_key, matched_pet_key)
);

alter table public.meeting_traces add column if not exists status text not null default 'pending';
alter table public.meeting_traces add column if not exists requested_by text not null default 'me';

alter table public.meeting_traces enable row level security;
drop policy if exists "Users can manage their own meeting traces" on public.meeting_traces;
create policy "Users can manage their own meeting traces" on public.meeting_traces
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Social graph: a match exists only after two different owners like each other.
create table if not exists public.pet_swipes (
  id uuid primary key default gen_random_uuid(),
  from_pet_id uuid not null references public.pets(id) on delete cascade,
  to_pet_id uuid not null references public.pets(id) on delete cascade,
  action text not null check (action in ('LIKE', 'SKIP', 'SUPER_LIKE')),
  created_at timestamptz not null default now(),
  unique (from_pet_id, to_pet_id),
  check (from_pet_id <> to_pet_id)
);

create table if not exists public.pet_matches (
  id uuid primary key default gen_random_uuid(),
  pet_one_id uuid not null references public.pets(id) on delete cascade,
  pet_two_id uuid not null references public.pets(id) on delete cascade,
  match_type text not null check (match_type in ('FRIEND', 'LOVE', 'BOTH')) default 'BOTH',
  created_at timestamptz not null default now(),
  unique (pet_one_id, pet_two_id),
  check (pet_one_id < pet_two_id)
);

create table if not exists public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pet_matches(id) on delete cascade,
  sender_pet_id uuid not null references public.pets(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.pet_swipes enable row level security;
alter table public.pet_matches enable row level security;
alter table public.match_messages enable row level security;

drop policy if exists "Owners can create and read their pet swipes" on public.pet_swipes;
create policy "Owners can create and read their pet swipes" on public.pet_swipes
  for all using (
    exists (select 1 from public.pets where pets.id = pet_swipes.from_pet_id and pets.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.pets where pets.id = pet_swipes.from_pet_id and pets.owner_id = auth.uid())
  );

drop policy if exists "Match owners can read matches" on public.pet_matches;
create policy "Match owners can read matches" on public.pet_matches
  for select using (
    exists (
      select 1 from public.pets
      where pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
        and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "Match owners can read messages" on public.match_messages;
create policy "Match owners can read messages" on public.match_messages
  for select using (
    exists (
      select 1 from public.pet_matches
      join public.pets on pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
      where pet_matches.id = match_messages.match_id and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "Match owners can send messages" on public.match_messages;
create policy "Match owners can send messages" on public.match_messages
  for insert with check (
    exists (select 1 from public.pets where pets.id = match_messages.sender_pet_id and pets.owner_id = auth.uid())
    and exists (
      select 1 from public.pet_matches
      where pet_matches.id = match_messages.match_id
        and match_messages.sender_pet_id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
    )
  );

create or replace function public.create_reciprocal_pet_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.action in ('LIKE', 'SUPER_LIKE') and exists (
    select 1 from public.pet_swipes
    where from_pet_id = new.to_pet_id
      and to_pet_id = new.from_pet_id
      and action in ('LIKE', 'SUPER_LIKE')
  ) then
    insert into public.pet_matches (pet_one_id, pet_two_id)
    values (least(new.from_pet_id, new.to_pet_id), greatest(new.from_pet_id, new.to_pet_id))
    on conflict (pet_one_id, pet_two_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pet_swipes_create_reciprocal_match on public.pet_swipes;
create trigger pet_swipes_create_reciprocal_match
after insert or update of action on public.pet_swipes
for each row execute function public.create_reciprocal_pet_match();

-- A meeting proposal is shared by both owners of a match. It expires after 24 hours
-- or at the scheduled meeting time, whichever is first.
create table if not exists public.meeting_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pet_matches(id) on delete cascade,
  proposer_pet_id uuid not null references public.pets(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  marker text not null check (marker in ('pink', 'blue')),
  scheduled_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'completed')),
  accepted_at timestamptz,
  rejected_at timestamptz,
  check_in_code text check (check_in_code is null or check_in_code ~ '^[0-9]{3}$'),
  check_in_expires_at timestamptz,
  proposer_checked_in_at timestamptz,
  recipient_checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at <= scheduled_at)
);

create index if not exists meeting_proposals_match_status_idx on public.meeting_proposals (match_id, status);
create index if not exists meeting_proposals_expiry_idx on public.meeting_proposals (expires_at);

alter table public.meeting_proposals enable row level security;

drop policy if exists "Match owners can view meeting proposals" on public.meeting_proposals;
create policy "Match owners can view meeting proposals" on public.meeting_proposals
  for select using (
    exists (
      select 1 from public.pet_matches
      join public.pets on pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
      where pet_matches.id = meeting_proposals.match_id and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "Match owners can create meeting proposals" on public.meeting_proposals;
create policy "Match owners can create meeting proposals" on public.meeting_proposals
  for insert with check (
    exists (select 1 from public.pets where pets.id = meeting_proposals.proposer_pet_id and pets.owner_id = auth.uid())
    and exists (
      select 1 from public.pet_matches
      where pet_matches.id = meeting_proposals.match_id
        and meeting_proposals.proposer_pet_id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
    )
  );

create or replace function public.refresh_meeting_proposal_status(p_proposal_id uuid)
returns public.meeting_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.meeting_proposals;
begin
  update public.meeting_proposals
  set status = 'expired', updated_at = now()
  where id = p_proposal_id and status in ('pending', 'accepted') and expires_at <= now();

  select * into proposal from public.meeting_proposals where id = p_proposal_id;
  return proposal;
end;
$$;

create or replace function public.respond_to_meeting_proposal(p_proposal_id uuid, p_accept boolean)
returns public.meeting_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.meeting_proposals;
begin
  select * into proposal from public.refresh_meeting_proposal_status(p_proposal_id);
  if proposal is null then raise exception 'Meeting proposal not found'; end if;
  if proposal.status <> 'pending' then return proposal; end if;
  if proposal.proposer_pet_id in (select id from public.pets where owner_id = auth.uid()) then
    raise exception 'The proposer cannot respond to their own meeting proposal';
  end if;
  if not exists (
    select 1 from public.pet_matches
    join public.pets on pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
    where pet_matches.id = proposal.match_id and pets.owner_id = auth.uid()
  ) then raise exception 'Not allowed'; end if;

  update public.meeting_proposals
  set status = case when p_accept then 'accepted' else 'rejected' end,
      accepted_at = case when p_accept then now() else null end,
      rejected_at = case when p_accept then null else now() end,
      updated_at = now()
  where id = p_proposal_id
  returning * into proposal;
  return proposal;
end;
$$;

create or replace function public.get_meeting_check_in_code(p_proposal_id uuid)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.meeting_proposals;
begin
  select * into proposal from public.refresh_meeting_proposal_status(p_proposal_id);
  if proposal is null or proposal.status <> 'accepted' then raise exception 'Meeting is not available for check-in'; end if;
  if not exists (
    select 1 from public.pet_matches
    join public.pets on pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
    where pet_matches.id = proposal.match_id and pets.owner_id = auth.uid()
  ) then raise exception 'Not allowed'; end if;
  if now() < proposal.scheduled_at - interval '30 minutes' then raise exception 'Check-in opens 30 minutes before the meeting'; end if;

  if proposal.check_in_code is null or proposal.check_in_expires_at is null or proposal.check_in_expires_at <= now() then
    update public.meeting_proposals
    set check_in_code = lpad((floor(random() * 1000))::int::text, 3, '0'),
        check_in_expires_at = now() + interval '30 seconds',
        proposer_checked_in_at = null,
        recipient_checked_in_at = null,
        updated_at = now()
    where id = p_proposal_id
    returning * into proposal;
  end if;
  return query select proposal.check_in_code, proposal.check_in_expires_at;
end;
$$;

create or replace function public.confirm_meeting_check_in(p_proposal_id uuid, p_code text)
returns public.meeting_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.meeting_proposals;
  caller_pet_id uuid;
begin
  select * into proposal from public.refresh_meeting_proposal_status(p_proposal_id);
  select id into caller_pet_id from public.pets where owner_id = auth.uid() and id in (
    select pet_one_id from public.pet_matches where id = proposal.match_id
    union all
    select pet_two_id from public.pet_matches where id = proposal.match_id
  ) limit 1;
  if proposal is null or proposal.status <> 'accepted' or caller_pet_id is null then raise exception 'Not allowed'; end if;
  if proposal.check_in_code is null or proposal.check_in_expires_at <= now() or proposal.check_in_code <> p_code then raise exception 'Invalid or expired code'; end if;

  update public.meeting_proposals
  set proposer_checked_in_at = case when caller_pet_id = proposer_pet_id then now() else proposer_checked_in_at end,
      recipient_checked_in_at = case when caller_pet_id <> proposer_pet_id then now() else recipient_checked_in_at end,
      updated_at = now()
  where id = p_proposal_id
  returning * into proposal;

  if proposal.proposer_checked_in_at is not null and proposal.recipient_checked_in_at is not null then
    update public.meeting_proposals
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = p_proposal_id
    returning * into proposal;
  end if;
  return proposal;
end;
$$;

create or replace function public.award_treats(p_pet_id uuid, p_amount integer, p_reason text, p_context_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_balance integer;
begin
  if current_user_id is null or p_amount <= 0 then
    return null;
  end if;

  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = current_user_id) then
    return null;
  end if;

  insert into public.treat_events (pet_id, reason, context_key, amount)
  values (p_pet_id, p_reason, p_context_key, p_amount)
  on conflict (pet_id, context_key) do nothing;

  if found then
    update public.pets
    set treats = treats + p_amount,
      matches_count = matches_count + case when p_reason = 'match' then 1 else 0 end,
      outings_count = outings_count + case when p_reason = 'outing' then 1 else 0 end,
      xp = xp + p_amount * 2 + case when p_reason = 'match' then 35 else 30 end,
      updated_at = now()
    where id = p_pet_id
    returning treats into new_balance;
    update public.pets
    set level = case
      when xp >= 1400 then 6
      when xp >= 1000 then 5
      when xp >= 700 then 4
      when xp >= 450 then 3
      when xp >= 250 then 2
      else 1
    end
    where id = p_pet_id;
  else
    select treats into new_balance from public.pets where id = p_pet_id;
  end if;

  return coalesce(new_balance, 0);
end;
$$;
