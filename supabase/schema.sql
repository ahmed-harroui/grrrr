create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pet_name text not null default 'Rocky',
  breed text not null default 'Golden Retriever',
  age integer not null default 3 check (age between 0 and 40),
  city text not null default 'Paris',
  bio text not null default '',
  energy smallint not null default 3 check (energy between 1 and 4),
  mode integer not null default 70 check (mode between 0 and 100),
  photo_url text not null default 'https://placedog.net/600/700?id=1',
  updated_at timestamptz not null default now()
);

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
