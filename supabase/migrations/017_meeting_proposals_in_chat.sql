-- Outings between two matched pets, shared by both owners. Safe to run again.
-- The app used to keep an outing only on the proposer's side (meeting_traces): the other
-- owner never received it. Outings now go through meeting_proposals (schema.sql):
--   propose_meeting: the proposer picks the spot, the day and the hour; the other owner is
--                    told by a 📍 chat message (and its notification) and is the one who answers;
--   answer_meeting:  only the other owner accepts or declines; the proposer is told the same way;
--   cancel_meeting:  either owner withdraws a pending or accepted outing.
-- A new proposal replaces the previous one of the same conversation.

-- Withdrawn outings get their own status.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.meeting_proposals'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.meeting_proposals drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.meeting_proposals add constraint meeting_proposals_status_check
  check (status in ('pending', 'accepted', 'rejected', 'expired', 'completed', 'cancelled'));

-- p_label: the day and hour as the proposer's phone shows them (e.g. "samedi 4 octobre à 18:30"),
-- written in the chat message; the database only knows UTC.
create or replace function public.propose_meeting(
  p_pet_id uuid, p_other_pet_id uuid, p_latitude double precision, p_longitude double precision,
  p_marker text, p_scheduled_at timestamptz, p_label text
)
returns public.meeting_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.pets;
  other public.pets;
  v_match uuid;
  proposal public.meeting_proposals;
  v_label text := left(coalesce(nullif(trim(p_label), ''), to_char(p_scheduled_at, 'DD/MM HH24:MI')), 60);
begin
  select * into me from public.pets where id = p_pet_id and owner_id = auth.uid();
  if not found then raise exception 'Not allowed'; end if;
  select * into other from public.pets where id = p_other_pet_id;
  if not found then raise exception 'Not allowed'; end if;
  select id into v_match from public.pet_matches
  where pet_one_id = least(me.id, other.id) and pet_two_id = greatest(me.id, other.id);
  if v_match is null then raise exception 'NOT_MATCHED'; end if;
  if p_scheduled_at <= now() + interval '5 minutes' then raise exception 'TIME_PASSED'; end if;
  if p_marker not in ('pink', 'blue') then raise exception 'Invalid marker'; end if;

  update public.meeting_proposals set status = 'cancelled', updated_at = now()
  where match_id = v_match and status in ('pending', 'accepted');

  insert into public.meeting_proposals (match_id, proposer_pet_id, latitude, longitude, marker, scheduled_at, expires_at)
  values (v_match, me.id, p_latitude, p_longitude, p_marker, p_scheduled_at, least(now() + interval '24 hours', p_scheduled_at))
  returning * into proposal;

  insert into public.match_messages (match_id, sender_pet_id, body)
  values (v_match, me.id, '📍 Sortie proposée : ' || case when p_marker = 'pink' then 'rendez-vous Hot ❤️' else 'sortie Friend 🐾' end
    || ' le ' || v_label || '. ' || other.pet_name || ', accepte ou refuse en haut de la conversation.');
  return proposal;
end;
$$;

-- Only the owner who received the proposal answers it.
create or replace function public.answer_meeting(p_proposal_id uuid, p_accept boolean)
returns public.meeting_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.meeting_proposals;
  v_pet uuid;
begin
  select * into proposal from public.meeting_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Meeting proposal not found'; end if;
  select pets.id into v_pet from public.pet_matches
  join public.pets on pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
  where pet_matches.id = proposal.match_id and pets.owner_id = auth.uid() and pets.id <> proposal.proposer_pet_id
  limit 1;
  if v_pet is null then raise exception 'NOT_RECIPIENT'; end if;
  if proposal.status <> 'pending' then return proposal; end if;
  -- Too late to answer: the app shows it as expired.
  if proposal.expires_at <= now() then
    update public.meeting_proposals set status = 'expired', updated_at = now() where id = p_proposal_id returning * into proposal;
    return proposal;
  end if;

  -- Accepted: it stays valid until the meeting time (no more 24-hour answer window).
  update public.meeting_proposals
  set status = case when p_accept then 'accepted' else 'rejected' end,
      accepted_at = case when p_accept then now() else null end,
      rejected_at = case when p_accept then null else now() end,
      expires_at = case when p_accept then scheduled_at else expires_at end,
      updated_at = now()
  where id = p_proposal_id
  returning * into proposal;

  insert into public.match_messages (match_id, sender_pet_id, body)
  values (proposal.match_id, v_pet, case when p_accept
    then '📍 Sortie acceptée ✅ : rendez-vous confirmé, le lieu est sur la carte.'
    else '📍 Sortie refusée : pas cette fois, proposez un autre moment.' end);
  return proposal;
end;
$$;

-- Either owner withdraws the outing.
create or replace function public.cancel_meeting(p_proposal_id uuid)
returns public.meeting_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.meeting_proposals;
  v_pet uuid;
begin
  select * into proposal from public.meeting_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Meeting proposal not found'; end if;
  select pets.id into v_pet from public.pet_matches
  join public.pets on pets.id in (pet_matches.pet_one_id, pet_matches.pet_two_id)
  where pet_matches.id = proposal.match_id and pets.owner_id = auth.uid()
  limit 1;
  if v_pet is null then raise exception 'Not allowed'; end if;
  if proposal.status not in ('pending', 'accepted') then return proposal; end if;

  update public.meeting_proposals set status = 'cancelled', updated_at = now()
  where id = p_proposal_id
  returning * into proposal;

  insert into public.match_messages (match_id, sender_pet_id, body)
  values (proposal.match_id, v_pet, '📍 Sortie annulée.');
  return proposal;
end;
$$;

revoke execute on function public.propose_meeting(uuid, uuid, double precision, double precision, text, timestamptz, text) from public, anon;
revoke execute on function public.answer_meeting(uuid, boolean) from public, anon;
revoke execute on function public.cancel_meeting(uuid) from public, anon;
grant execute on function public.propose_meeting(uuid, uuid, double precision, double precision, text, timestamptz, text) to authenticated;
grant execute on function public.answer_meeting(uuid, boolean) to authenticated;
grant execute on function public.cancel_meeting(uuid) to authenticated;

notify pgrst, 'reload schema';
