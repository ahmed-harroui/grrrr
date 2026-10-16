-- Birthdays with the age and the birth date, and challenges. Safe to run again. Run after 020.
--   * from 10:00 Paris, the birthday: "Luna a 5 ans aujourd'hui ! 🎂" with the birth date, and a week
--     before to get ready (only for accounts without GRR Care on a phone: Care sends it there);
--   * the daily message at 18:00, when nothing waits (likes, messages, the week's visit), is a
--     challenge for the pet's species one day and a fact the next.
-- The two helpers are shared with GRR Care (its migration 025 has the same definitions).

-- Shared by GRRR Care (migration 025) and GRRRR (migration 029): birthdays and challenges.

-- A birthday in a given year (29 February falls on the 28th in other years).
create or replace function public.pet_birthday_in_year(p_birthday date, p_year integer)
returns date
language sql
immutable
as $$
  select case
    when extract(month from p_birthday) = 2 and extract(day from p_birthday) = 29
      and not (p_year % 4 = 0 and (p_year % 100 <> 0 or p_year % 400 = 0)) then make_date(p_year, 2, 28)
    else make_date(p_year, extract(month from p_birthday)::integer, extract(day from p_birthday)::integer)
  end
$$;

-- The birthday notification of a pet for today: on the day (with its age and birth date), and a
-- week before to get ready. Null on the other days, and for a pet not yet one year old.
create or replace function public.pet_birthday_notice(p_name text, p_birthday date, p_today date)
returns jsonb
language plpgsql
immutable
as $$
declare
  months_fr text[] := array['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  months_en text[] := array['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  next_day date;
  days integer;
  age integer;
  born_fr text;
  born_en text;
  on_fr text;
  on_en text;
  age_fr text;
  age_en text;
begin
  if p_birthday is null or p_birthday > p_today then return null; end if;
  next_day := public.pet_birthday_in_year(p_birthday, extract(year from p_today)::integer);
  if next_day < p_today then next_day := public.pet_birthday_in_year(p_birthday, extract(year from p_today)::integer + 1); end if;
  days := next_day - p_today;
  age := extract(year from next_day)::integer - extract(year from p_birthday)::integer;
  if age < 1 or days not in (0, 7) then return null; end if;

  on_fr := case when extract(day from p_birthday) = 1 then '1er' else extract(day from p_birthday)::text end || ' ' || months_fr[extract(month from p_birthday)::integer];
  on_en := extract(day from p_birthday)::text || ' ' || months_en[extract(month from p_birthday)::integer];
  born_fr := on_fr || ' ' || extract(year from p_birthday)::text;
  born_en := on_en || ' ' || extract(year from p_birthday)::text;
  age_fr := age || ' an' || case when age > 1 then 's' else '' end;
  age_en := age || ' year' || case when age > 1 then 's' else '' end || ' old';

  if days = 0 then
    return jsonb_build_object('key', 'birthday:' || extract(year from next_day), 'icon', '🎂',
      'titleFr', p_name || ' a ' || age_fr || ' aujourd''hui ! 🎂', 'titleEn', p_name || ' is ' || age_en || ' today! 🎂',
      'bodyFr', 'Le ' || born_fr || ', une belle histoire commençait. Une balade, une friandise… et une photo pour son album 📸',
      'bodyEn', 'On ' || born_en || ', a great story began. A walk, a treat… and a photo for the album 📸');
  end if;
  return jsonb_build_object('key', 'birthday7:' || extract(year from next_day), 'icon', '🎁',
    'titleFr', 'Dans 7 jours, ' || p_name || ' aura ' || age_fr, 'titleEn', 'In 7 days, ' || p_name || ' turns ' || age,
    'bodyFr', 'Son anniversaire tombe le ' || on_fr || '. De quoi préparer une petite surprise !',
    'bodyEn', 'The birthday is on ' || on_en || '. Time to plan a little surprise!');
end;
$$;

-- A challenge for the pet's species, a different one each time `p_turn` changes (the app's home
-- screen has the full list: src/lib/challenges.ts in GRRR Care).
create or replace function public.pet_challenge(p_species text, p_turn integer)
returns jsonb
language plpgsql
immutable
as $$
declare
  s text := lower(coalesce(p_species, ''));
  pool jsonb[];
begin
  pool := case
    when s ~ 'dog|chien' then array[
      jsonb_build_object('icon', '🔎', 'fr', 'Cache 3 croquettes dans la pièce et laisse-le les trouver.', 'en', 'Hide 3 treats in the room and let them sniff them out.'),
      jsonb_build_object('icon', '🌿', 'fr', 'Un nouvel itinéraire de balade : nouvelles odeurs, cerveau ravi.', 'en', 'A new walking route: new smells, happy brain.'),
      jsonb_build_object('icon', '✋', 'fr', 'Apprends-lui « touche » : le museau dans ta main, puis une récompense.', 'en', 'Teach "touch": nose in your hand, then a reward.'),
      jsonb_build_object('icon', '🪢', 'fr', 'Tir à la corde, puis « lâche » contre une friandise.', 'en', 'Tug of war, then "drop it" for a treat.'),
      jsonb_build_object('icon', '🐾', 'fr', 'Vérifie ses coussinets au retour de balade.', 'en', 'Check the paw pads after the walk.')]
    when s ~ 'cat|chat' then array[
      jsonb_build_object('icon', '🪶', 'fr', 'Une plume au bout d''une ficelle : 10 minutes de chasse.', 'en', 'A feather on a string: 10 minutes of hunting.'),
      jsonb_build_object('icon', '📦', 'fr', 'Un carton vide dans le salon. Observe.', 'en', 'An empty box in the living room. Watch.'),
      jsonb_build_object('icon', '🥤', 'fr', 'Une friandise cachée sous un gobelet : à lui de la trouver.', 'en', 'A treat hidden under a cup: their turn to find it.'),
      jsonb_build_object('icon', '🎣', 'fr', 'Une séance de jeu avant le dîner, puis le repas : comme une vraie chasse.', 'en', 'Play before dinner, then the meal: like a real hunt.'),
      jsonb_build_object('icon', '😌', 'fr', 'Cligne lentement des yeux vers lui : ça veut dire « j''ai confiance ».', 'en', 'Blink slowly at them: it means "I trust you".')]
    when s ~ 'rabbit|lapin' then array[
      jsonb_build_object('icon', '🐇', 'fr', 'Une heure de course libre dans une pièce sécurisée.', 'en', 'An hour of free running in a safe room.'),
      jsonb_build_object('icon', '🌾', 'fr', 'Des herbes cachées dans le foin : à lui de fouiller.', 'en', 'Herbs hidden in the hay: foraging time.'),
      jsonb_build_object('icon', '🕳️', 'fr', 'Un tunnel en carton à explorer et à ronger.', 'en', 'A cardboard tunnel to explore and chew.')]
    when s ~ 'bird|oiseau|parrot|perroquet|perruche' then array[
      jsonb_build_object('icon', '🌰', 'fr', 'Une friandise emballée dans du papier, à déballer.', 'en', 'A treat wrapped in paper, to unwrap.'),
      jsonb_build_object('icon', '🔄', 'fr', 'Change les jouets de la cage : la nouveauté chasse l''ennui.', 'en', 'Swap the cage toys: novelty fights boredom.'),
      jsonb_build_object('icon', '💦', 'fr', 'Une douche tiède en brumisation pour le plumage.', 'en', 'A lukewarm mist shower for the feathers.')]
    when s ~ 'hamster|guinea|gerbil' then array[
      jsonb_build_object('icon', '🧩', 'fr', 'Un labyrinthe en carton avec une graine au bout.', 'en', 'A cardboard maze with a seed at the end.'),
      jsonb_build_object('icon', '🌻', 'fr', 'Sa nourriture éparpillée au lieu de la gamelle : une nuit de fouille.', 'en', 'Food scattered instead of in the bowl: a night of foraging.')]
    when s ~ 'horse|cheval|pony|poney' then array[
      jsonb_build_object('icon', '🧲', 'fr', 'Cure ses quatre sabots.', 'en', 'Pick out all four hooves.'),
      jsonb_build_object('icon', '🌳', 'fr', 'Une balade en main sur un nouveau chemin.', 'en', 'A walk in hand on a new path.')]
    when s ~ 'turtle|tortoise|tortue' then array[
      jsonb_build_object('icon', '☀️', 'fr', 'Vérifie la lampe chauffante et les UV.', 'en', 'Check the heat lamp and the UV.'),
      jsonb_build_object('icon', '🌼', 'fr', 'Pissenlit et trèfle au menu aujourd''hui.', 'en', 'Dandelion and clover on the menu today.')]
    when s ~ 'fish|poisson' then array[
      jsonb_build_object('icon', '🪣', 'fr', 'Change un quart de l''eau, à la même température.', 'en', 'Change a quarter of the water, at the same temperature.'),
      jsonb_build_object('icon', '🧪', 'fr', 'Teste l''eau de l''aquarium aujourd''hui.', 'en', 'Test the tank water today.')]
    else array[
      jsonb_build_object('icon', '🤍', 'fr', 'Quelques minutes au calme ensemble, sans écran.', 'en', 'A few quiet minutes together, no screen.'),
      jsonb_build_object('icon', '✨', 'fr', 'Un nouvel objet à explorer dans son espace.', 'en', 'A new object to explore in its space.')]
  end;
  return pool[1 + (abs(p_turn) % array_length(pool, 1))];
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
  v_notice jsonb;
  v_challenge jsonb;
  birthday record;
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

  -- 2. Birthdays, from 10:00 Paris: on the day (age and birth date) and a week before. Accounts with
  -- GRR Care on a phone get it from Care (its migration 025): never twice.
  if extract(hour from paris) >= 10 then
    for birthday in
      select p.id, p.pet_name, p.birthday::date as born
      from public.pets p
      where p.birthday is not null and not coalesce(p.is_bot, false) and not coalesce(p.adopter_only, false) and not coalesce(p.setup_pending, false)
        and exists (select 1 from public.push_tokens t where t.user_id = p.owner_id and coalesce((to_jsonb(t) ->> 'app'), 'grrrr') = 'grrrr')
        and not exists (select 1 from public.push_tokens t where t.user_id = p.owner_id and (to_jsonb(t) ->> 'app') = 'care')
    loop
      v_notice := public.pet_birthday_notice(birthday.pet_name, birthday.born, paris::date);
      if v_notice is not null and public.remind_pet(birthday.id, v_notice ->> 'key', null, jsonb_build_object(
        'kind', 'birthday', 'icon', v_notice ->> 'icon', 'screen', 'pet',
        'titleFr', v_notice ->> 'titleFr', 'titleEn', v_notice ->> 'titleEn', 'bodyFr', v_notice ->> 'bodyFr', 'bodyEn', v_notice ->> 'bodyEn'
      )) then sent := sent + 1; end if;
    end loop;
  end if;

  -- 3. The daily one, from 18:00 Paris: one per account, about its pet with the most XP.
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
    v_challenge := public.pet_challenge(account.species, v_day / 2);
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
      -- Nothing waiting: a challenge one day, a fact the next
      when v_day % 2 = 0 then jsonb_build_object(
        'kind', 'challenge', 'icon', '🎯', 'screen', 'pet',
        'titleFr', 'Défi du jour pour ' || account.pet_name, 'titleEn', 'Today''s challenge for ' || account.pet_name,
        'bodyFr', (v_challenge ->> 'icon') || ' ' || (v_challenge ->> 'fr'), 'bodyEn', (v_challenge ->> 'icon') || ' ' || (v_challenge ->> 'en'))
      else jsonb_build_object(
        'kind', 'fact', 'icon', '🧠', 'screen', 'explore',
        'titleFr', 'Le savais-tu ?', 'titleEn', 'Did you know?',
        'bodyFr', v_fact ->> 'fr', 'bodyEn', v_fact ->> 'en')
    end) then sent := sent + 1; end if;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.send_scheduled_reminders() from public, anon, authenticated;
