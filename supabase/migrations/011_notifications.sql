      -- Notifications. Safe to run again.
      -- 1. notifications: one row per event for a pet (like, match, message, outing, level up),
      --    written by triggers so they exist even when the owner was offline.
      -- 2. announcements: news for everyone (shop, new threads, care tips).
      -- 3. push_tokens: the phones to notify when the app is closed. The push itself is sent by
      --    the send-push Edge Function (supabase/functions/send-push), called by a Database
      --    Webhook on every new notification / announcement.

      -- Left over from an earlier version of this migration.
      alter table public.pets drop column if exists eyes_crop;

      create table if not exists public.notifications (
        id uuid primary key default gen_random_uuid(),
        pet_id uuid not null references public.pets(id) on delete cascade,
        type text not null,
        actor_pet_id uuid references public.pets(id) on delete cascade,
        data jsonb not null default '{}',
        read_at timestamptz,
        created_at timestamptz not null default now()
      );

      create index if not exists notifications_pet_created_idx on public.notifications (pet_id, created_at desc);

      alter table public.notifications enable row level security;

      drop policy if exists "Owners can read their pet notifications" on public.notifications;
      create policy "Owners can read their pet notifications" on public.notifications
        for select using (exists (select 1 from public.pets where pets.id = notifications.pet_id and pets.owner_id = auth.uid()));

      drop policy if exists "Owners can update their pet notifications" on public.notifications;
      create policy "Owners can update their pet notifications" on public.notifications
        for update using (exists (select 1 from public.pets where pets.id = notifications.pet_id and pets.owner_id = auth.uid()));

      drop policy if exists "Owners can delete their pet notifications" on public.notifications;
      create policy "Owners can delete their pet notifications" on public.notifications
        for delete using (exists (select 1 from public.pets where pets.id = notifications.pet_id and pets.owner_id = auth.uid()));

      -- Internal: rows are only written by the triggers below (test bots get none).
      create or replace function public.notify_pet(p_pet_id uuid, p_type text, p_actor_pet_id uuid, p_data jsonb)
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        if exists (select 1 from public.pets where id = p_pet_id and is_bot) then return; end if;
        insert into public.notifications (pet_id, type, actor_pet_id, data)
        values (p_pet_id, p_type, p_actor_pet_id, coalesce(p_data, '{}'::jsonb));
      end;
      $$;

      -- A like that is not (yet) a match: the liked pet is told, with the mood it was sent in.
      create or replace function public.notify_like()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        if upper(new.action) not in ('LIKE', 'SUPER_LIKE') then return new; end if;
        if tg_op = 'UPDATE' and upper(old.action) in ('LIKE', 'SUPER_LIKE') then return new; end if;
        if exists (
          select 1 from public.pet_swipes back
          where back.from_pet_id = new.to_pet_id and back.to_pet_id = new.from_pet_id and upper(back.action) in ('LIKE', 'SUPER_LIKE')
        ) then return new; end if;
        perform public.notify_pet(
          new.to_pet_id,
          case when upper(new.action) = 'SUPER_LIKE' then 'super_like' else 'like' end,
          new.from_pet_id,
          jsonb_build_object('intent', new.intent)
        );
        return new;
      end;
      $$;

      drop trigger if exists pet_swipes_notify_like on public.pet_swipes;
      create trigger pet_swipes_notify_like
      after insert or update of action on public.pet_swipes
      for each row execute function public.notify_like();

      -- A match: both pets are told.
      create or replace function public.notify_match()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        perform public.notify_pet(new.pet_one_id, 'match', new.pet_two_id, jsonb_build_object('match_id', new.id, 'match_type', new.match_type));
        perform public.notify_pet(new.pet_two_id, 'match', new.pet_one_id, jsonb_build_object('match_id', new.id, 'match_type', new.match_type));
        return new;
      end;
      $$;

      drop trigger if exists pet_matches_notify on public.pet_matches;
      create trigger pet_matches_notify
      after insert on public.pet_matches
      for each row execute function public.notify_match();

      -- A chat message: the other pet of the conversation is told (outing proposals start with 📍).
      create or replace function public.notify_message()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $$
      declare
        other_id uuid;
      begin
        select case when pet_one_id = new.sender_pet_id then pet_two_id else pet_one_id end into other_id
        from public.pet_matches where id = new.match_id;
        if other_id is null then return new; end if;
        perform public.notify_pet(
          other_id,
          case when new.body like '📍%' then 'meeting' else 'message' end,
          new.sender_pet_id,
          jsonb_build_object('match_id', new.match_id, 'preview', left(new.body, 140))
        );
        return new;
      end;
      $$;

      drop trigger if exists match_messages_notify on public.match_messages;
      create trigger match_messages_notify
      after insert on public.match_messages
      for each row execute function public.notify_message();

      -- A level gained.
      create or replace function public.notify_level_up()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        if new.level > coalesce(old.level, 1) then
          perform public.notify_pet(new.id, 'level_up', null, jsonb_build_object('level', new.level));
        end if;
        return new;
      end;
      $$;

      drop trigger if exists pets_notify_level_up on public.pets;
      create trigger pets_notify_level_up
      after update of level on public.pets
      for each row execute function public.notify_level_up();

      revoke execute on function public.notify_pet(uuid, text, uuid, jsonb) from public, anon, authenticated;
      revoke execute on function public.notify_like() from public, anon, authenticated;
      revoke execute on function public.notify_match() from public, anon, authenticated;
      revoke execute on function public.notify_message() from public, anon, authenticated;
      revoke execute on function public.notify_level_up() from public, anon, authenticated;

      -- News sent to everyone. Add a row here (SQL Editor or Table Editor) to notify every user.
      -- type: 'store' (shop news), 'thread' (new Explore thread), 'care' (health tip), 'news' (app news).
      create table if not exists public.announcements (
        id uuid primary key default gen_random_uuid(),
        type text not null check (type in ('store', 'thread', 'care', 'news')),
        title_fr text not null,
        title_en text not null,
        body_fr text not null default '',
        body_en text not null default '',
        url text,
        created_at timestamptz not null default now()
      );

      alter table public.announcements enable row level security;

      drop policy if exists "Everyone can read announcements" on public.announcements;
      create policy "Everyone can read announcements" on public.announcements
        for select using (true);

      insert into public.announcements (id, type, title_fr, title_en, body_fr, body_en, url) values
        ('a0110000-0000-4000-8000-000000000001', 'store', 'Nouveautés dans la boutique', 'New in the shop', 'Laisses, harnais et jouets pour les balades qui comptent.', 'Leashes, harnesses and toys for the walks that matter.', 'https://grrrr-store-89il.vercel.app/'),
        ('a0110000-0000-4000-8000-000000000002', 'thread', 'Nouveau thread : le petit rituel qui rapproche', 'New thread: the little ritual that brings you closer', '3 idées simples pour une première balade réussie.', '3 simple ideas for a great first walk.', null),
        ('a0110000-0000-4000-8000-000000000003', 'care', 'Pense au carnet de santé', 'Remember the health record', 'Vaccins et visites à jour dans GRRRR Care : un compagnon en forme.', 'Vaccines and vet visits up to date in GRRRR Care: a healthy companion.', 'https://care.greatrascals.com/')
      on conflict (id) do nothing;

      -- Phones that receive push notifications: one row per installed app (Expo push token).
      create table if not exists public.push_tokens (
        token text primary key,
        user_id uuid not null references auth.users(id) on delete cascade,
        platform text,
        language text not null default 'fr',
        -- Categories switched off in the app: {"messages": false, ...}
        prefs jsonb not null default '{}',
        updated_at timestamptz not null default now()
      );

      create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

      alter table public.push_tokens enable row level security;

      drop policy if exists "Users can read their push tokens" on public.push_tokens;
      create policy "Users can read their push tokens" on public.push_tokens
        for select using (auth.uid() = user_id);

      -- A phone belongs to the account signed in on it last.
      create or replace function public.register_push_token(p_token text, p_platform text, p_language text, p_prefs jsonb)
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $$
      begin
        if auth.uid() is null or coalesce(p_token, '') = '' then return; end if;
        insert into public.push_tokens (token, user_id, platform, language, prefs)
        values (p_token, auth.uid(), p_platform, coalesce(p_language, 'fr'), coalesce(p_prefs, '{}'::jsonb))
        on conflict (token) do update
          set user_id = excluded.user_id, platform = excluded.platform, language = excluded.language, prefs = excluded.prefs, updated_at = now();
      end;
      $$;

      -- Called at sign-out, when the session is already gone.
      create or replace function public.unregister_push_token(p_token text)
      returns void
      language sql
      security definer
      set search_path = public
      as $$
        delete from public.push_tokens where token = p_token;
      $$;

      revoke execute on function public.register_push_token(text, text, text, jsonb) from public, anon;
      grant execute on function public.register_push_token(text, text, text, jsonb) to authenticated;
      grant execute on function public.unregister_push_token(text) to anon, authenticated;

      -- Live delivery to the app (RLS still limits who receives what).
      do $$
      begin
        if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
          alter publication supabase_realtime add table public.notifications;
        end if;
        if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements') then
          alter publication supabase_realtime add table public.announcements;
        end if;
      end $$;

      notify pgrst, 'reload schema';
