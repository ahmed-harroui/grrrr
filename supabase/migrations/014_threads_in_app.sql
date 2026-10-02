-- Threads in the app. Safe to run again.
-- The community tables (grr_members, grr_threads, grr_thread_likes...) come from the Grr
-- website's schema and live in this database: the app reads, upvotes and posts in the same
-- threads. Posting and upvoting need a grr_members row, created at sign-up by the website's
-- trigger; accounts older than that trigger have none. The app calls the function below
-- before a first upvote or post, so every account ends up with one.

-- A member row for the signed-in account (username from the e-mail, made unique,
-- name and avatar from the app profile).
create or replace function public.ensure_grr_member()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  base text;
  candidate text;
  v_name text;
  v_avatar text;
begin
  if auth.uid() is null or exists (select 1 from public.grr_members where id = auth.uid()) then return; end if;
  select email into v_email from auth.users where id = auth.uid();
  base := coalesce(nullif(regexp_replace(lower(split_part(coalesce(v_email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), ''), 'member');
  candidate := left(base, 18);
  if char_length(candidate) < 3 then candidate := candidate || 'grr'; end if;
  while exists (select 1 from public.grr_members where username = candidate) loop
    candidate := left(base, 18) || floor(random() * 10000)::int;
  end loop;
  select nullif(left(trim(display_name), 40), ''), nullif(trim(avatar_url), '') into v_name, v_avatar
  from public.profiles where user_id = auth.uid();
  insert into public.grr_members (id, username, display_name, avatar_url)
  values (auth.uid(), candidate, v_name, v_avatar)
  on conflict (id) do nothing;
end;
$$;

revoke execute on function public.ensure_grr_member() from public, anon;
grant execute on function public.ensure_grr_member() to authenticated;

notify pgrst, 'reload schema';
