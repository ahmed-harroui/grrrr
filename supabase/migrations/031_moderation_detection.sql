-- Moderation, found automatically: each profile gets the reasons it looks wrong, and the queue puts
-- the most suspicious first. Strong reasons put it in "À revoir"; weak ones only show as badges.
--
-- Strong: a listed word (insult, a person's first name, a fake name), the owner's own name, contact
--         details or a link in the text, a name that looks like a test or keyboard mash.
-- Weak:   no photo, the app's example photo, no description or the default one.

-- 1. The words, by kind: the kind becomes the suggested reason when the admin hides the profile
alter table public.moderation_words add column if not exists kind text not null default 'person'
  check (kind in ('person', 'insult', 'fake'));

insert into public.moderation_words (word, kind) values
  -- insults: French, English, Darija (Latin letters and digits)
  ('pute', 'insult'), ('putain', 'insult'), ('salope', 'insult'), ('connard', 'insult'), ('connasse', 'insult'),
  ('encule', 'insult'), ('enculé', 'insult'), ('batard', 'insult'), ('bâtard', 'insult'), ('merde', 'insult'),
  ('nique', 'insult'), ('niquer', 'insult'), ('ntm', 'insult'), ('fdp', 'insult'), ('pd', 'insult'), ('bite', 'insult'),
  ('couille', 'insult'), ('chatte', 'insult'), ('fuck', 'insult'), ('fucked', 'insult'), ('fucking', 'insult'),
  ('shit', 'insult'), ('bitch', 'insult'), ('dick', 'insult'), ('cock', 'insult'), ('pussy', 'insult'), ('porn', 'insult'),
  ('porno', 'insult'), ('sex', 'insult'), ('sexe', 'insult'), ('nazi', 'insult'), ('hitler', 'insult'),
  ('zebi', 'insult'), ('zeb', 'insult'), ('zab', 'insult'), ('zamel', 'insult'), ('qahba', 'insult'), ('kahba', 'insult'),
  ('9ahba', 'insult'), ('t9awed', 'insult'), ('tqawed', 'insult'), ('nikmok', 'insult'), ('nik', 'insult'),
  ('tabon', 'insult'), ('terma', 'insult'), ('sharmouta', 'insult'), ('charmouta', 'insult'), ('khra', 'insult'),
  ('hmar', 'insult'), ('mok', 'insult'),
  -- first names of people, rare for pets
  ('mohamed', 'person'), ('mohammed', 'person'), ('mehdi', 'person'), ('youssef', 'person'), ('yassine', 'person'),
  ('yasser', 'person'), ('hamza', 'person'), ('karim', 'person'), ('rachid', 'person'), ('omar', 'person'),
  ('othmane', 'person'), ('ayoub', 'person'), ('anas', 'person'), ('ilyas', 'person'), ('wassim', 'person'),
  ('soufiane', 'person'), ('amine', 'person'), ('fatima', 'person'), ('khadija', 'person'), ('aicha', 'person'),
  ('imane', 'person'), ('salma', 'person'), ('meryem', 'person'), ('zineb', 'person'), ('hajar', 'person'),
  ('kevin', 'person'), ('jordan', 'person'), ('nicolas', 'person'), ('julien', 'person'), ('thomas', 'person'),
  -- not names at all
  ('test', 'fake'), ('testt', 'fake'), ('toto', 'fake'), ('azerty', 'fake'), ('qwerty', 'fake'), ('asdf', 'fake'),
  ('you', 'fake'), ('moi', 'fake'), ('me', 'fake'), ('admin', 'fake'), ('null', 'fake'), ('undefined', 'fake'),
  ('aaa', 'fake'), ('xxx', 'fake')
on conflict (word) do update set kind = excluded.kind;
update public.moderation_words set kind = 'person' where word in ('ahmed', 'hmida');

-- 2. The queue, with its reasons
create or replace function public.admin_pet_queue(p_mode text default 'review', p_limit integer default 300)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  with words as (
    select
      coalesce(string_agg(word, '|') filter (where kind = 'insult'), '^$') as insults,
      coalesce(string_agg(word, '|') filter (where kind = 'person'), '^$') as people,
      coalesce(string_agg(word, '|') filter (where kind = 'fake'), '^$') as fakes
    from public.moderation_words
  ),
  base as (
    select p.*,
      u.created_at as owner_since,
      (select count(*) from public.pets o where o.owner_id = p.owner_id and not coalesce(o.setup_pending, false)) as owner_pets,
      lower(coalesce(p.pet_name, '') || ' ' || coalesce(p.bio, '') || ' ' || coalesce(p.breed, '')) as txt,
      regexp_replace(lower(translate(coalesce(p.pet_name, ''), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucaaaeeeeiioouuuc')), '[^a-z0-9]', '', 'g') as nm,
      lower(translate(concat_ws(' ', pr.display_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
        'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucaaaeeeeiioouuuc')) as owner_names,
      lower(split_part(u.email, '@', 1)) as owner_mail
    from public.pets p
    left join auth.users u on u.id = p.owner_id
    left join public.profiles pr on pr.user_id = p.owner_id
    where not coalesce(p.is_bot, false) and not coalesce(p.setup_pending, false)
  ),
  checked as (
    select b.*,
      substring(b.txt from '\m(' || w.insults || ')\M') as insult_word,
      substring(b.txt from '\m(' || w.people || ')\M') as person_word,
      substring(b.nm from '^(' || w.fakes || ')$') as fake_word,
      length(b.nm) >= 3 and (b.owner_names ~ ('(^|[^a-z])' || b.nm || '([^a-z]|$)') or (length(b.nm) >= 4 and position(b.nm in b.owner_mail) > 0)) as owner_name,
      b.txt ~ '(https?://|www\.|\.com\M|@[a-z0-9_]{3,}|(\d[ .-]?){8,}|whatsapp|snapchat|snap\M|insta(gram)?\M|telegram|onlyfans)' as contact,
      b.nm ~ '(.)\1\1' or (length(b.nm) >= 4 and b.nm !~ '[aeiouy]') or b.nm ~ '^[0-9]+$' or length(b.nm) < 2 as mash,
      coalesce(b.photo_url, '') = '' and coalesce(cardinality(b.photos), 0) = 0 as no_photo,
      coalesce(b.photo_url, '') ~ '(placedog\.net|cataas\.com)' as example_photo,
      trim(coalesce(b.bio, '')) in ('', 'A new companion to discover.', 'Un nouveau compagnon à découvrir.') as no_bio
    from base b cross join words w
  ),
  scored as (
    select c.*,
      array_remove(array[
        case when insult_word is not null then 'insult' end,
        case when person_word is not null then 'person_name' end,
        case when owner_name then 'owner_name' end,
        case when contact then 'contact' end,
        case when fake_word is not null or mash then 'fake_name' end,
        case when example_photo then 'example_photo' end,
        case when no_photo then 'no_photo' end,
        case when no_bio then 'no_bio' end
      ], null) as reasons,
      (insult_word is not null or person_word is not null or owner_name or contact or fake_word is not null or mash) as strong,
      (case when insult_word is not null then 40 else 0 end) + (case when contact then 30 else 0 end)
        + (case when person_word is not null or owner_name then 25 else 0 end) + (case when fake_word is not null or mash then 20 else 0 end)
        + (case when example_photo then 6 else 0 end) + (case when no_photo then 4 else 0 end) + (case when no_bio then 1 else 0 end) as score
    from checked c
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', pet_name, 'species', species, 'breed', breed, 'gender', gender, 'age', age, 'city', city, 'bio', bio,
      'photo', photo_url, 'photos', to_jsonb(photos), 'tags', to_jsonb(tags), 'createdAt', created_at,
      'ownerSince', owner_since, 'ownerPets', owner_pets, 'adopterOnly', coalesce(adopter_only, false),
      'bannedAt', banned_at, 'bannedReason', banned_reason, 'reviewRequestedAt', review_requested_at,
      'flagged', strong, 'reasons', to_jsonb(reasons), 'score', score,
      'words', to_jsonb(array_remove(array[insult_word, person_word, fake_word], null)),
      'suggested', case when insult_word is not null then 'insult' when person_word is not null or owner_name then 'person_name'
                        when contact or fake_word is not null or mash then 'other' when example_photo then 'photo' end
    ) order by (review_requested_at is not null) desc, score desc, created_at desc), '[]')
  from (
    select * from scored
    where case p_mode
      when 'banned' then banned_at is not null
      when 'review' then banned_at is null and (review_requested_at is not null or (approved_at is null and strong))
      else true end
    order by (review_requested_at is not null) desc, score desc, created_at desc
    limit p_limit
  ) q
$$;

revoke execute on function public.admin_pet_queue(text, integer) from public, anon, authenticated;
grant execute on function public.admin_pet_queue(text, integer) to service_role;

notify pgrst, 'reload schema';
