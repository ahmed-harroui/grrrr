-- Daily rewards. Safe to run again.
-- One streak per account, shared by the GRRRR and GRRR Care apps (same database): a gift to
-- collect once a day, from either app. A missed day starts again at day 1; the gifts grow:
--   day 1: 1 treat · day 2: 2 · day 3: 3 · day 4: 5 · day 5: a GRRRR Shop gift voucher ·
--   day 6: 8 treats · day 7: one month of the GRRR Care AI assistant without the daily limit,
--   once per account (the first week completed); the next weeks, day 7 is a chest of 12 treats.
-- After day 7 a new week starts at day 1. Days follow Paris time.
-- Treats go to the pet given by the app (the active one), else the account's pet with most XP.

-- Treats now also come from the daily gifts.
alter table public.treat_events drop constraint if exists treat_events_reason_check;
alter table public.treat_events add constraint treat_events_reason_check check (reason in ('match', 'outing', 'daily'));

-- The month of AI assistant (read by the grrr-chat Edge Function of GRRR Care).
alter table public.profiles add column if not exists care_ai_until timestamptz;

create table if not exists public.daily_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- The day (1..7) of the last gift collected, and when.
  day integer not null default 0 check (day between 0 and 7),
  last_claim date,
  best integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.daily_streaks enable row level security;
drop policy if exists "Users read their streak" on public.daily_streaks;
create policy "Users read their streak" on public.daily_streaks for select using (auth.uid() = user_id);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_on date not null,
  day integer not null,
  app text not null default 'grrrr',
  reward jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, claimed_on)
);
alter table public.reward_claims enable row level security;
drop policy if exists "Users read their gifts" on public.reward_claims;
create policy "Users read their gifts" on public.reward_claims for select using (auth.uid() = user_id);

-- The week of gifts (same for both apps).
create or replace function public.daily_reward_for(p_day integer)
returns jsonb
language sql
immutable
as $$
  select case p_day
    when 1 then jsonb_build_object('kind', 'treats', 'amount', 1)
    when 2 then jsonb_build_object('kind', 'treats', 'amount', 2)
    when 3 then jsonb_build_object('kind', 'treats', 'amount', 3)
    when 4 then jsonb_build_object('kind', 'treats', 'amount', 5)
    when 5 then jsonb_build_object('kind', 'voucher')
    when 6 then jsonb_build_object('kind', 'treats', 'amount', 8)
    else jsonb_build_object('kind', 'care_ai', 'days', 30)
  end
$$;

-- Where the streak stands: the day to collect next, whether today's is done, the AI month.
create or replace function public.get_daily_streak()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  s public.daily_streaks;
  claimed_today boolean;
  next_day integer;
  v_until timestamptz;
begin
  if auth.uid() is null then return null; end if;
  select * into s from public.daily_streaks where user_id = auth.uid();
  claimed_today := s.last_claim = today;
  next_day := case
    when s.last_claim is null then 1
    when s.last_claim = today then s.day
    when s.last_claim = today - 1 then case when s.day >= 7 then 1 else s.day + 1 end
    else 1
  end;
  select care_ai_until into v_until from public.profiles where user_id = auth.uid();
  return jsonb_build_object(
    'day', next_day,
    'claimedToday', coalesce(claimed_today, false),
    -- Days already collected in the current week (shown as done in the chain).
    'done', case when claimed_today then s.day when s.last_claim = today - 1 and s.day < 7 then s.day else 0 end,
    'best', coalesce(s.best, 0),
    'careAiUntil', v_until,
    'lastReward', (select reward from public.reward_claims where user_id = auth.uid() order by claimed_on desc limit 1),
    -- The AI month is given once: after that, day 7 is a chest of treats.
    'aiMonthUsed', exists (select 1 from public.reward_claims where user_id = auth.uid() and reward ->> 'kind' = 'care_ai')
  );
end;
$$;

-- Collects today's gift. Errors the app explains: ALREADY_CLAIMED.
create or replace function public.claim_daily_reward(p_app text default 'grrrr', p_pet_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Europe/Paris')::date;
  s public.daily_streaks;
  v_day integer;
  v_reward jsonb;
  v_pet uuid;
  v_until timestamptz;
begin
  if me is null then raise exception 'Not allowed'; end if;
  insert into public.daily_streaks (user_id) values (me) on conflict do nothing;
  select * into s from public.daily_streaks where user_id = me for update;
  if s.last_claim = today then raise exception 'ALREADY_CLAIMED'; end if;
  v_day := case when s.last_claim = today - 1 and s.day < 7 then s.day + 1 else 1 end;
  v_reward := public.daily_reward_for(v_day);
  -- The AI month is given once per account: the next weeks end with a chest of treats.
  if v_reward ->> 'kind' = 'care_ai' and exists (select 1 from public.reward_claims where user_id = me and reward ->> 'kind' = 'care_ai') then
    v_reward := jsonb_build_object('kind', 'treats', 'amount', 12);
  end if;

  if v_reward ->> 'kind' = 'treats' then
    select id into v_pet from public.pets
    where owner_id = me and not coalesce(adopter_only, false)
    order by (id = p_pet_id) desc, xp desc nulls last
    limit 1;
    if v_pet is not null then
      insert into public.treat_events (pet_id, reason, context_key, amount)
      values (v_pet, 'daily', 'daily:' || today, (v_reward ->> 'amount')::integer)
      on conflict (pet_id, context_key) do nothing;
      if found then
        update public.pets set treats = treats + (v_reward ->> 'amount')::integer, updated_at = now() where id = v_pet;
      end if;
      v_reward := v_reward || jsonb_build_object('petId', v_pet, 'petName', (select pet_name from public.pets where id = v_pet));
    end if;
  elsif v_reward ->> 'kind' = 'voucher' then
    v_reward := v_reward || jsonb_build_object('code', 'GRRRR-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)));
  else
    insert into public.profiles (user_id) values (me) on conflict (user_id) do nothing;
    update public.profiles
    set care_ai_until = greatest(now(), coalesce(care_ai_until, now())) + make_interval(days => (v_reward ->> 'days')::integer)
    where user_id = me
    returning care_ai_until into v_until;
    v_reward := v_reward || jsonb_build_object('until', v_until);
  end if;

  update public.daily_streaks
  set day = v_day, last_claim = today, best = greatest(best, v_day), updated_at = now()
  where user_id = me;
  insert into public.reward_claims (user_id, claimed_on, day, app, reward)
  values (me, today, v_day, case when p_app = 'care' then 'care' else 'grrrr' end, v_reward);
  return v_reward || jsonb_build_object('day', v_day);
end;
$$;

revoke execute on function public.get_daily_streak() from public, anon;
revoke execute on function public.claim_daily_reward(text, uuid) from public, anon;
grant execute on function public.get_daily_streak() to authenticated;
grant execute on function public.claim_daily_reward(text, uuid) to authenticated;

notify pgrst, 'reload schema';
