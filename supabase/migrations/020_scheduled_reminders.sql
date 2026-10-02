-- Scheduled reminders. Safe to run again. Run after 019 (the push webhooks).
-- Notifications that come on their own, without the user doing anything:
--   * once a day around 18:00 (Paris), one per account: the likes waiting for an answer, or the
--     messages to read, or the week's visit that keeps the streak, or a fact about its pet;
--   * about an hour before a confirmed outing, to both pets.
-- They are rows of public.notifications (type 'reminder', texts in both languages in data),
-- so they show in the app and go to the phones through the push webhook like the others.
-- pg_cron runs public.send_scheduled_reminders() every hour.

create extension if not exists pg_cron;

-- What was already sent, so nothing is sent twice.
create table if not exists public.reminder_log (
  pet_id uuid not null references public.pets(id) on delete cascade,
  reminder_key text not null,
  sent_at timestamptz not null default now(),
  primary key (pet_id, reminder_key)
);
alter table public.reminder_log enable row level security;
-- No policy: only the functions below use it.

create or replace function public.remind_pet(p_pet_id uuid, p_key text, p_actor_pet_id uuid, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reminder_log (pet_id, reminder_key) values (p_pet_id, p_key) on conflict do nothing;
  if not found then return false; end if;
  perform public.notify_pet(p_pet_id, 'reminder', p_actor_pet_id, p_data);
  return true;
end;
$$;

create or replace function public.send_scheduled_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sent integer := 0;
  paris timestamp := now() at time zone 'Europe/Paris';
  outing record;
  account record;
  v_likes integer;
  v_unread integer;
  v_visited boolean;
  v_fact jsonb;
  v_day integer := extract(doy from paris)::integer;
begin
  -- 1. Outings starting in 30 to 90 minutes: both pets are reminded once.
  for outing in
    select mp.id, mp.scheduled_at, pm.pet_one_id, pm.pet_two_id,
           p1.pet_name as one_name, p2.pet_name as two_name
    from public.meeting_proposals mp
    join public.pet_matches pm on pm.id = mp.match_id
    join public.pets p1 on p1.id = pm.pet_one_id
    join public.pets p2 on p2.id = pm.pet_two_id
    where mp.status = 'accepted' and mp.scheduled_at between now() + interval '30 minutes' and now() + interval '90 minutes'
  loop
    if public.remind_pet(outing.pet_one_id, 'outing:' || outing.id, outing.pet_two_id, jsonb_build_object(
      'kind', 'outing', 'icon', '📍', 'screen', 'chat',
      'titleFr', 'Sortie avec ' || outing.two_name || ' bientôt', 'titleEn', 'Outing with ' || outing.two_name || ' soon',
      'bodyFr', 'Rendez-vous à ' || to_char(outing.scheduled_at at time zone 'Europe/Paris', 'HH24:MI') || ' : le lieu est sur la carte. Bonne balade !',
      'bodyEn', 'Meet at ' || to_char(outing.scheduled_at at time zone 'Europe/Paris', 'HH24:MI') || ': the spot is on the map. Enjoy the walk!'
    )) then sent := sent + 1; end if;
    if public.remind_pet(outing.pet_two_id, 'outing:' || outing.id, outing.pet_one_id, jsonb_build_object(
      'kind', 'outing', 'icon', '📍', 'screen', 'chat',
      'titleFr', 'Sortie avec ' || outing.one_name || ' bientôt', 'titleEn', 'Outing with ' || outing.one_name || ' soon',
      'bodyFr', 'Rendez-vous à ' || to_char(outing.scheduled_at at time zone 'Europe/Paris', 'HH24:MI') || ' : le lieu est sur la carte. Bonne balade !',
      'bodyEn', 'Meet at ' || to_char(outing.scheduled_at at time zone 'Europe/Paris', 'HH24:MI') || ': the spot is on the map. Enjoy the walk!'
    )) then sent := sent + 1; end if;
  end loop;

  -- 2. The daily one, from 18:00 Paris: one per account, about its pet with the most XP.
  if extract(hour from paris) < 18 then return sent; end if;
  for account in
    select distinct on (p.owner_id) p.id, p.pet_name, p.species, p.adopter_only
    from public.pets p
    where not coalesce(p.is_bot, false) and not coalesce(p.setup_pending, false)
      -- A GRRRR phone (the `app` column comes with GRRR Care's migration 016).
      and exists (select 1 from public.push_tokens t where t.user_id = p.owner_id and coalesce((to_jsonb(t) ->> 'app'), 'grrrr') = 'grrrr')
    order by p.owner_id, coalesce(p.adopter_only, false), p.xp desc nulls last
  loop
    -- Likes waiting for an answer (same rule as get_pet_likers).
    select count(distinct s.from_pet_id) into v_likes
    from public.pet_swipes s
    where s.to_pet_id = account.id and upper(s.action) in ('LIKE', 'SUPER_LIKE')
      and not exists (select 1 from public.pet_swipes back where back.from_pet_id = account.id and back.to_pet_id = s.from_pet_id)
      and not exists (select 1 from public.pet_matches m where m.pet_one_id = least(account.id, s.from_pet_id) and m.pet_two_id = greatest(account.id, s.from_pet_id));
    select count(*) into v_unread from public.notifications n
    where n.pet_id = account.id and n.read_at is null and n.type in ('message', 'meeting', 'relation', 'adoption');
    v_visited := exists (select 1 from public.pet_weekly_visits v where v.pet_id = account.id and v.week_start = date_trunc('week', now())::date);
    v_fact := case
      when lower(account.species) = 'cat' then (array[
        jsonb_build_object('fr', 'Un chat cligne lentement des yeux pour dire qu''il a confiance.', 'en', 'A cat blinks slowly to say it trusts you.'),
        jsonb_build_object('fr', 'Le ronronnement apaise aussi le chat lui-même.', 'en', 'Purring also soothes the cat itself.'),
        jsonb_build_object('fr', 'Un chat dort entre 12 et 16 heures par jour.', 'en', 'A cat sleeps 12 to 16 hours a day.'),
        jsonb_build_object('fr', 'Les moustaches d''un chat mesurent la largeur des passages.', 'en', 'A cat''s whiskers measure the width of openings.')
      ])[1 + v_day % 4]
      when lower(account.species) = 'dog' then (array[
        jsonb_build_object('fr', 'La truffe d''un chien est unique, comme une empreinte digitale.', 'en', 'A dog''s nose print is unique, like a fingerprint.'),
        jsonb_build_object('fr', 'Un chien comprend en moyenne 150 mots.', 'en', 'A dog understands about 150 words.'),
        jsonb_build_object('fr', 'Les chiens transpirent surtout par les coussinets.', 'en', 'Dogs sweat mostly through their paw pads.'),
        jsonb_build_object('fr', 'Bâiller est contagieux aussi entre un chien et son humain.', 'en', 'Yawning is contagious between a dog and their human too.')
      ])[1 + v_day % 4]
      else (array[
        jsonb_build_object('fr', 'Quelques minutes de jeu par jour renforcent le lien avec ton compagnon.', 'en', 'A few minutes of play a day strengthen the bond with your companion.'),
        jsonb_build_object('fr', 'Les routines rassurent la plupart des animaux.', 'en', 'Routines reassure most animals.')
      ])[1 + v_day % 2]
    end;

    if public.remind_pet(account.id, 'daily:' || to_char(paris, 'YYYY-MM-DD'), null, case
      when v_likes > 0 and not coalesce(account.adopter_only, false) then jsonb_build_object(
        'kind', 'likes', 'icon', '💌', 'screen', 'matches',
        'titleFr', case when v_likes > 1 then v_likes || ' compagnons ont liké ' || account.pet_name else 'Un compagnon a liké ' || account.pet_name end,
        'titleEn', case when v_likes > 1 then v_likes || ' companions liked ' || account.pet_name else 'A companion liked ' || account.pet_name end,
        'bodyFr', 'Ils t''attendent, floutés : découvre-les dans Discover 👀', 'bodyEn', 'They are waiting, blurred: discover them in Discover 👀')
      when v_unread > 0 then jsonb_build_object(
        'kind', 'unread', 'icon', '💬', 'screen', 'chat',
        'titleFr', 'Des messages t''attendent', 'titleEn', 'Messages are waiting',
        'bodyFr', v_unread || ' message' || case when v_unread > 1 then 's' else '' end || ' à lire pour ' || account.pet_name || '.',
        'bodyEn', v_unread || ' message' || case when v_unread > 1 then 's' else '' end || ' to read for ' || account.pet_name || '.')
      when not v_visited and not coalesce(account.adopter_only, false) then jsonb_build_object(
        'kind', 'streak', 'icon', '🔥', 'screen', 'pet',
        'titleFr', account.pet_name || ' attend sa visite de la semaine', 'titleEn', account.pet_name || ' is waiting for this week''s visit',
        'bodyFr', 'Ouvre GRRRR pour garder ta série et gagner de l''XP.', 'bodyEn', 'Open GRRRR to keep your streak and earn XP.')
      else jsonb_build_object(
        'kind', 'fact', 'icon', '🧠', 'screen', 'explore',
        'titleFr', 'Le savais-tu ?', 'titleEn', 'Did you know?',
        'bodyFr', v_fact ->> 'fr', 'bodyEn', v_fact ->> 'en')
    end) then sent := sent + 1; end if;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.remind_pet(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.send_scheduled_reminders() from public, anon, authenticated;

-- Every hour (the daily one waits for 18:00 Paris; the outing ones need the hourly check).
select cron.schedule('grrrr-reminders', '0 * * * *', 'select public.send_scheduled_reminders()');
