-- Push webhooks. Safe to run again.
-- Every new notification (one pet's events) and announcement (news for everyone) is posted to
-- the send-push Edge Function, which sends it to the phones (Expo push → Firebase / Apple).
-- The shared secret checked by the function is kept in Supabase Vault under the name
-- 'push_webhook_secret' (the same value as the function's PUSH_WEBHOOK_SECRET); it never
-- appears here. Without it, nothing is posted.
-- The URL is this project's (ref mfamxvbepohyeigpnsyi).

create or replace function public.trg_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  if v_secret is null then return new; end if;
  -- Same payload as a Supabase Database Webhook; pg_net sends it after the transaction.
  perform net.http_post(
    url := 'https://mfamxvbepohyeigpnsyi.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('type', 'INSERT', 'table', tg_table_name, 'schema', tg_table_schema, 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- A push that cannot be queued never blocks the notification itself.
  raise warning 'Push not queued for %: %', tg_table_name, sqlerrm;
  return new;
end;
$$;

revoke execute on function public.trg_send_push() from public, anon, authenticated;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
after insert on public.notifications
for each row execute function public.trg_send_push();

drop trigger if exists announcements_send_push on public.announcements;
create trigger announcements_send_push
after insert on public.announcements
for each row execute function public.trg_send_push();
