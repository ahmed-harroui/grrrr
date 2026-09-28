-- Discovery + test bots.
-- 1. pets.country so Discover can rank: same city, then same country, then everyone else.
-- 2. A "bot" account with test pets that like you back automatically (instant match + a
--    welcome message), handy to test matches, chat and XP. Safe to run again.

alter table public.pets add column if not exists country text;
alter table public.pets add column if not exists is_bot boolean not null default false;

-- Everyone signed in can see every pet (already the case, kept here for clarity).
drop policy if exists "Authenticated users can discover pets" on public.pets;
create policy "Authenticated users can discover pets" on public.pets
  for select using (auth.uid() is not null);

-- Bot account that owns the test pets (never used to sign in).
do $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('b0770000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'bots@greatrascals.com', '', now(), '{"provider":"email","providers":["email"]}', '{"bot":true}', now(), now())
  on conflict (id) do nothing;
exception when others then
  raise notice 'Bot account not created (test pets will be skipped): %', sqlerrm;
end $$;

-- Test pets are collected in a temp table first, then inserted one by one (see below)
-- so a pet refused by a constraint is skipped instead of cancelling everything.
-- Fixed ids: re-running updates them instead of duplicating.
drop table if exists pg_temp.bot_seed;
create temp table bot_seed (id uuid, pet_name text, species text, breed text, age int, gender text, city text, country text, bio text, energy int, mode int, photo_url text, photos text[], tags text[]);

insert into bot_seed values
  ('b0770000-0000-4000-8000-000000000101'::uuid, 'Biscuit', 'dog', 'Golden Retriever', 3, 'M', 'Bordeaux', 'France', 'Toujours partant pour une balade sur les quais et un bain dans la Garonne.', 4, 20, 'https://placedog.net/600/700?id=31', array['https://placedog.net/600/700?id=32','https://placedog.net/600/700?id=33'], array['🎾 Joueur','⚡ Énergique','❤️ Sociable']),
  ('b0770000-0000-4000-8000-000000000102', 'Praline', 'dog', 'Cavalier King Charles', 2, 'F', 'Bordeaux', 'France', 'Petite douceur qui adore les câlins et les terrasses ensoleillées.', 2, 80, 'https://placedog.net/600/700?id=34', array['https://placedog.net/600/700?id=35'], array['🥰 Câlin','🛋️ Chill','🌿 Curieux']),
  ('b0770000-0000-4000-8000-000000000103', 'Rex', 'dog', 'Berger Australien', 4, 'M', 'Bordeaux', 'France', 'Sportif et malin, je cherche un copain pour courir au parc Bordelais.', 4, 70, 'https://placedog.net/600/700?id=36', array['https://placedog.net/600/700?id=37'], array['🏃 Sportif','🧠 Malin','⚡ Énergique']),
  ('b0770000-0000-4000-8000-000000000104', 'Mochi', 'cat', 'Européen', 2, 'F', 'Bordeaux', 'France', 'Curieuse et indépendante, je passe mes journées à la fenêtre.', 2, 30, 'https://cataas.com/cat?width=600&height=700&r=1', array['https://cataas.com/cat?width=600&height=700&r=2'], array['🌿 Curieux','😴 Dormeur','🛋️ Chill']),
  ('b0770000-0000-4000-8000-000000000105', 'Oscar', 'cat', 'Maine Coon', 5, 'M', 'Bordeaux', 'France', 'Grand gentil poilu, fan de croquettes et de siestes au soleil.', 1, 75, 'https://cataas.com/cat?width=600&height=700&r=3', array['https://cataas.com/cat?width=600&height=700&r=4'], array['🍖 Gourmand','😴 Dormeur','🥰 Câlin']),
  ('b0770000-0000-4000-8000-000000000106', 'Nina', 'dog', 'Border Collie', 3, 'F', 'Paris', 'France', 'Balades au bois de Vincennes et frisbee, qui me suit ?', 4, 60, 'https://placedog.net/600/700?id=38', array['https://placedog.net/600/700?id=39'], array['🏃 Sportif','🎾 Joueur','🧠 Malin']),
  ('b0770000-0000-4000-8000-000000000107', 'Pepper', 'dog', 'Beagle', 2, 'M', 'Lyon', 'France', 'Mon nez me guide partout, surtout vers les pique-niques.', 3, 25, 'https://placedog.net/600/700?id=40', array['https://placedog.net/600/700?id=41'], array['🐾 Explorateur','🍖 Gourmand','❤️ Sociable']),
  ('b0770000-0000-4000-8000-000000000108', 'Lili', 'cat', 'Siamois', 3, 'F', 'Paris', 'France', 'Bavarde et joueuse, je cherche une copine pour les après-midis.', 3, 15, 'https://cataas.com/cat?width=600&height=700&r=5', array['https://cataas.com/cat?width=600&height=700&r=6'], array['🎾 Joueur','❤️ Sociable','🌿 Curieux']),
  ('b0770000-0000-4000-8000-000000000109', 'Bruno', 'dog', 'Bouledogue Français', 5, 'M', 'Bruxelles', 'Belgique', 'Petit mais costaud, grand amateur de siestes et de gaufres.', 1, 85, 'https://placedog.net/600/700?id=42', array['https://placedog.net/600/700?id=43'], array['🛋️ Chill','🍖 Gourmand','🥰 Câlin']),
  ('b0770000-0000-4000-8000-000000000110', 'Kiara', 'dog', 'Husky', 2, 'F', 'Montréal', 'Canada', 'Neige, courses et hurlements joyeux : je suis prête pour l''aventure.', 4, 40, 'https://placedog.net/600/700?id=44', array['https://placedog.net/600/700?id=45'], array['⚡ Énergique','🐾 Explorateur','🏃 Sportif']),
  ('b0770000-0000-4000-8000-000000000111', 'Caramel', 'dog', 'Labrador', 3, 'F', 'Bordeaux', 'France', 'Gourmande et câline, je nage mieux que toi au lac de Bordeaux.', 3, 65, 'https://placedog.net/600/700?id=46', array['https://placedog.net/600/700?id=47'], array['🌊 Aime l''eau','🍖 Gourmand','🥰 Câlin']),
  ('b0770000-0000-4000-8000-000000000112', 'Filou', 'dog', 'Jack Russell', 2, 'M', 'Bordeaux', 'France', 'Petite fusée à poils, je ne tiens pas en place.', 4, 15, 'https://placedog.net/600/700?id=48', array['https://placedog.net/600/700?id=49'], array['⚡ Énergique','🎾 Joueur','🐾 Explorateur']),
  ('b0770000-0000-4000-8000-000000000113', 'Luna', 'dog', 'Shiba Inu', 4, 'F', 'Bordeaux', 'France', 'Indépendante mais fidèle, balade tranquille au Jardin Public ?', 2, 35, 'https://placedog.net/600/700?id=50', array['https://placedog.net/600/700?id=51'], array['🌿 Curieux','🛋️ Chill','🧠 Malin']),
  ('b0770000-0000-4000-8000-000000000114', 'Hugo', 'dog', 'Cocker', 5, 'M', 'Mérignac', 'France', 'Doux et patient, j''adore les enfants et les longues siestes.', 2, 90, 'https://placedog.net/600/700?id=52', array['https://placedog.net/600/700?id=53'], array['🤝 Gentil avec les enfants','😴 Dormeur','🥰 Câlin']),
  ('b0770000-0000-4000-8000-000000000115', 'Simba', 'cat', 'Bengal', 2, 'M', 'Bordeaux', 'France', 'Mini panthère joueuse, je grimpe partout.', 4, 20, 'https://cataas.com/cat?width=600&height=700&r=7', array['https://cataas.com/cat?width=600&height=700&r=8'], array['🎾 Joueur','⚡ Énergique','🐾 Explorateur']),
  ('b0770000-0000-4000-8000-000000000116', 'Cleo', 'cat', 'Ragdoll', 4, 'F', 'Bordeaux', 'France', 'Toute douce, je me laisse porter comme une peluche.', 1, 70, 'https://cataas.com/cat?width=600&height=700&r=9', array['https://cataas.com/cat?width=600&height=700&r=10'], array['🥰 Câlin','🛋️ Chill','😴 Dormeur']),
  ('b0770000-0000-4000-8000-000000000117', 'Noisette', 'rabbit', 'Bélier nain', 1, 'F', 'Bordeaux', 'France', 'Petites oreilles tombantes et grosses envies de carottes.', 2, 30, 'https://loremflickr.com/600/700/rabbit?lock=11', array['https://loremflickr.com/600/700/rabbit?lock=12'], array['🍖 Gourmand','🥰 Câlin','🌿 Curieux']),
  ('b0770000-0000-4000-8000-000000000118', 'Pistache', 'guinea_pig', 'Abyssin', 2, 'M', 'Bordeaux', 'France', 'Je couine de joie quand j''entends le frigo s''ouvrir.', 2, 25, 'https://loremflickr.com/600/700/guineapig?lock=13', array['https://loremflickr.com/600/700/guineapig?lock=14'], array['🍖 Gourmand','❤️ Sociable','😴 Dormeur']),
  ('b0770000-0000-4000-8000-000000000119', 'Kiwi', 'parrot', 'Perruche', 3, 'M', 'Paris', 'France', 'Je siffle la Marseillaise et je dis bonjour à tout le monde.', 3, 20, 'https://loremflickr.com/600/700/parrot?lock=15', array['https://loremflickr.com/600/700/parrot?lock=16'], array['❤️ Sociable','🧠 Malin','🎾 Joueur']),
  ('b0770000-0000-4000-8000-000000000120', 'Nougat', 'hamster', 'Syrien', 1, 'F', 'Lyon', 'France', 'Championne de la roue la nuit, reine des joues pleines le jour.', 3, 20, 'https://loremflickr.com/600/700/hamster?lock=17', array['https://loremflickr.com/600/700/hamster?lock=18'], array['⚡ Énergique','🍖 Gourmand','😴 Dormeur']),
  ('b0770000-0000-4000-8000-000000000121', 'Zorro', 'ferret', 'Furet putoisé', 2, 'M', 'Bordeaux', 'France', 'Curieux et farceur, je cache tes chaussettes partout.', 4, 55, 'https://loremflickr.com/600/700/ferret?lock=19', array['https://loremflickr.com/600/700/ferret?lock=20'], array['🐾 Explorateur','🎾 Joueur','🧠 Malin']),
  ('b0770000-0000-4000-8000-000000000122', 'Bella', 'dog', 'Caniche', 6, 'F', 'Arcachon', 'France', 'Élégante, j''aime la plage d''Arcachon et les belles rencontres.', 2, 85, 'https://placedog.net/600/700?id=54', array['https://placedog.net/600/700?id=55'], array['❤️ Sociable','🌊 Aime l''eau','🥰 Câlin']);

-- 60 more generated test pets, mostly around Bordeaux, so Discover always has plenty to swipe.
insert into bot_seed
select
  md5('grrrr-bot-' || i)::uuid,
  (array['Max','Milo','Ruby','Lola','Oslo','Pixel','Tango','Mango','Olive','Paco','Gaïa','Sushi','Tofu','Jazz','Ziggy','Plume','Cookie','Loki','Maya','Ulysse'])[1 + i % 20],
  case when i % 3 = 0 then 'cat' else 'dog' end,
  case when i % 3 = 0
    then (array['Européen','Chartreux','Persan','Sacré de Birmanie','British Shorthair'])[1 + i % 5]
    else (array['Labrador','Golden Retriever','Berger Allemand','Beagle','Bouledogue Français','Border Collie','Cavalier King Charles','Jack Russell','Husky','Teckel'])[1 + i % 10]
  end,
  1 + i % 9,
  case when i % 2 = 0 then 'F' else 'M' end,
  (array['Bordeaux','Bordeaux','Bordeaux','Mérignac','Pessac','Talence','Bègles','Arcachon','Paris','Lyon','Toulouse','Nantes','Marseille','Lille','Bruxelles','Genève'])[1 + i % 16],
  case 1 + i % 16 when 15 then 'Belgique' when 16 then 'Suisse' else 'France' end,
  (array[
    'Toujours partant pour une balade, surtout s''il y a des flaques.',
    'Câlin professionnel, je cherche un copain pour les siestes au soleil.',
    'Je cours plus vite que mon ombre, qui veut jouer à la balle ?',
    'Curieux de tout, je renifle chaque coin de la ville.',
    'Calme et gentil, parfait compagnon de terrasse.',
    'Gourmand assumé, je partage (presque) mes friandises.'
  ])[1 + i % 6],
  1 + i % 4,
  (i * 37) % 101,
  case when i % 3 = 0 then 'https://cataas.com/cat?width=600&height=700&r=' || (100 + i) else 'https://placedog.net/600/700?id=' || (60 + i) end,
  array[case when i % 3 = 0 then 'https://cataas.com/cat?width=600&height=700&r=' || (200 + i) else 'https://placedog.net/600/700?id=' || (130 + i) end],
  string_to_array((array[
    '🎾 Joueur,⚡ Énergique,❤️ Sociable',
    '🥰 Câlin,🛋️ Chill,😴 Dormeur',
    '🏃 Sportif,🐾 Explorateur,🧠 Malin',
    '🌿 Curieux,🍖 Gourmand,🤝 Gentil avec les enfants',
    '🌊 Aime l''eau,🎾 Joueur,❤️ Sociable'
  ])[1 + i % 5], ',')
from generate_series(1, 60) as i;

-- Insert each test pet on its own: a pet refused by a constraint (e.g. a species the
-- Care app doesn't allow) is skipped with a notice instead of cancelling the whole script.
do $$
declare
  r record;
  ok integer := 0;
  skipped integer := 0;
begin
  for r in select * from bot_seed loop
    begin
      insert into public.pets (id, owner_id, is_bot, pet_name, species, breed, age, gender, city, country, bio, energy, mode, photo_url, photos, tags)
      values (r.id, 'b0770000-0000-4000-8000-000000000001', true, r.pet_name, r.species, r.breed, r.age, r.gender, r.city, r.country, r.bio, r.energy, r.mode, r.photo_url, r.photos, r.tags)
      on conflict (id) do update set
        is_bot = true, pet_name = excluded.pet_name, species = excluded.species, breed = excluded.breed, age = excluded.age,
        gender = excluded.gender, city = excluded.city, country = excluded.country, bio = excluded.bio, energy = excluded.energy,
        mode = excluded.mode, photo_url = excluded.photo_url, photos = excluded.photos, tags = excluded.tags;
      ok := ok + 1;
    exception when others then
      skipped := skipped + 1;
      raise notice 'Test pet % skipped: %', r.pet_name, sqlerrm;
    end;
  end loop;
  raise notice '% test pets ready, % skipped', ok, skipped;
end $$;

-- A like on a bot pet is returned right away, which creates the match
-- (create_reciprocal_pet_match already turns two likes into a match).
create or replace function public.bot_like_back()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(new.action) in ('LIKE', 'SUPER_LIKE')
     and exists (select 1 from public.pets where id = new.to_pet_id and is_bot)
     and not exists (select 1 from public.pets where id = new.from_pet_id and is_bot) then
    insert into public.pet_swipes (from_pet_id, to_pet_id, action)
    values (new.to_pet_id, new.from_pet_id, 'LIKE')
    on conflict (from_pet_id, to_pet_id) do update set action = 'LIKE';
  end if;
  return new;
end;
$$;

drop trigger if exists pet_swipes_bot_like_back on public.pet_swipes;
create trigger pet_swipes_bot_like_back
after insert or update of action on public.pet_swipes
for each row execute function public.bot_like_back();

-- When a bot pet matches, it says hello in the chat.
create or replace function public.bot_welcome_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_id uuid;
begin
  select id into bot_id from public.pets where id in (new.pet_one_id, new.pet_two_id) and is_bot limit 1;
  if bot_id is not null then
    insert into public.match_messages (match_id, sender_pet_id, body)
    values (new.id, bot_id, 'Salut ! Trop contente de ce match 🐾 On se fait une balade bientôt ?');
  end if;
  return new;
end;
$$;

drop trigger if exists pet_matches_bot_welcome on public.pet_matches;
create trigger pet_matches_bot_welcome
after insert on public.pet_matches
for each row execute function public.bot_welcome_message();

-- Real-time chat: stream new messages to the app (RLS still limits who receives them).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_messages'
  ) then
    alter publication supabase_realtime add table public.match_messages;
  end if;
end $$;

revoke execute on function public.bot_like_back() from public, anon, authenticated;
revoke execute on function public.bot_welcome_message() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Result shown in the SQL Editor: how many test pets are ready to swipe.
select count(*) as test_pets_ready from public.pets where is_bot;
