import { supabase } from "@/lib/supabase";
import type { MeetingMarker, MeetingTrace } from "@/context/AppState";

interface MeetingTraceRow {
  owner_id: string;
  pet_key: string;
  matched_pet_key: string;
  latitude: number;
  longitude: number;
  marker: MeetingMarker;
  status?: "pending" | "confirmed";
  requested_by?: "me" | "them";
}

export type MeetingProposalStatus = "pending" | "accepted" | "rejected" | "expired" | "completed" | "cancelled";

export interface MeetingProposal {
  id: string;
  matchId: string;
  proposerPetId: string;
  latitude: number;
  longitude: number;
  marker: MeetingMarker;
  scheduledAt: string;
  expiresAt: string;
  status: MeetingProposalStatus;
  checkInExpiresAt?: string | null;
  completedAt?: string | null;
}

function toMeetingProposal(row: any): MeetingProposal {
  return {
    id: row.id,
    matchId: row.match_id,
    proposerPetId: row.proposer_pet_id,
    latitude: row.latitude,
    longitude: row.longitude,
    marker: row.marker,
    scheduledAt: row.scheduled_at,
    expiresAt: row.expires_at,
    status: row.status,
    checkInExpiresAt: row.check_in_expires_at,
    completedAt: row.completed_at,
  };
}

// Outings shared by both owners (migration 017): the proposer picks spot, day and hour; only
// the other owner answers. Each step is a 📍 chat message, so the other side is notified.

const isUuid = (id?: string) => Boolean(id && /^[0-9a-f-]{36}$/i.test(id));

/** Why the database refused an outing. */
export type MeetingError = "NOT_MATCHED" | "TIME_PASSED" | "NOT_RECIPIENT" | "UNKNOWN";
const toMeetingError = (message?: string): MeetingError =>
  (["NOT_MATCHED", "TIME_PASSED", "NOT_RECIPIENT"] as MeetingError[]).find((code) => message?.includes(code)) ?? "UNKNOWN";

/** Still to answer, or confirmed and not past: what the chat shows. */
export function isLiveMeeting(proposal: MeetingProposal | null): proposal is MeetingProposal {
  if (!proposal) return false;
  if (proposal.status === "pending") return new Date(proposal.expiresAt).getTime() > Date.now();
  // A confirmed outing stays shown until a few hours after its time.
  if (proposal.status === "accepted") return new Date(proposal.scheduledAt).getTime() + 6 * 3600_000 > Date.now();
  return false;
}

/** The latest outing between my pet and the other one (null when none was ever proposed). */
export async function getLatestMeeting(myPetId?: string, otherPetId?: string): Promise<MeetingProposal | null> {
  if (!supabase || !isUuid(myPetId) || !isUuid(otherPetId)) return null;
  const [one, two] = myPetId! < otherPetId! ? [myPetId, otherPetId] : [otherPetId, myPetId];
  const { data: match } = await supabase.from("pet_matches").select("id").eq("pet_one_id", one).eq("pet_two_id", two).maybeSingle();
  if (!match) return null;
  const { data, error } = await supabase.from("meeting_proposals").select("*").eq("match_id", match.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) console.warn("Outing could not be loaded", error.message);
  return data ? toMeetingProposal(data) : null;
}

/** The live outings of several conversations, for the map: newest per conversation. */
export async function getLiveMeetings(matchIds: string[]): Promise<MeetingProposal[]> {
  if (!supabase || matchIds.length === 0) return [];
  const { data, error } = await supabase.from("meeting_proposals").select("*").in("match_id", matchIds).in("status", ["pending", "accepted"]).order("created_at", { ascending: false });
  if (error) return [];
  const seen = new Set<string>();
  return (data ?? []).map(toMeetingProposal).filter((proposal) => !seen.has(proposal.matchId) && seen.add(proposal.matchId) && isLiveMeeting(proposal));
}

export async function proposeMeeting(input: { petId: string; otherPetId: string; latitude: number; longitude: number; marker: MeetingMarker; scheduledAt: Date; label: string }): Promise<{ proposal: MeetingProposal | null; error: MeetingError | null }> {
  if (!supabase) return { proposal: null, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("propose_meeting", {
    p_pet_id: input.petId,
    p_other_pet_id: input.otherPetId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_marker: input.marker,
    p_scheduled_at: input.scheduledAt.toISOString(),
    p_label: input.label,
  });
  if (error) console.warn("Outing not proposed", error.message);
  return { proposal: data ? toMeetingProposal(data) : null, error: error ? toMeetingError(error.message) : null };
}

export async function answerMeeting(proposalId: string, accept: boolean): Promise<{ proposal: MeetingProposal | null; error: MeetingError | null }> {
  if (!supabase) return { proposal: null, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("answer_meeting", { p_proposal_id: proposalId, p_accept: accept });
  if (error) console.warn("Outing not answered", error.message);
  return { proposal: data ? toMeetingProposal(data) : null, error: error ? toMeetingError(error.message) : null };
}

export async function cancelMeeting(proposalId: string): Promise<{ proposal: MeetingProposal | null; error: MeetingError | null }> {
  if (!supabase) return { proposal: null, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("cancel_meeting", { p_proposal_id: proposalId });
  if (error) console.warn("Outing not cancelled", error.message);
  return { proposal: data ? toMeetingProposal(data) : null, error: error ? toMeetingError(error.message) : null };
}

/** The next confirmed outing of my pet (for the widgets): with whom and when. */
export async function getNextOuting(myPetId?: string): Promise<{ petName: string; scheduledAt: string; marker: MeetingMarker } | null> {
  if (!supabase || !isUuid(myPetId)) return null;
  const { data: matches } = await supabase.from("pet_matches").select("id, pet_one_id, pet_two_id").or(`pet_one_id.eq.${myPetId},pet_two_id.eq.${myPetId}`);
  if (!matches?.length) return null;
  const { data: next } = await supabase
    .from("meeting_proposals")
    .select("match_id, scheduled_at, marker")
    .in("match_id", matches.map((match) => match.id))
    .eq("status", "accepted")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return null;
  const match = matches.find((item) => item.id === next.match_id);
  const otherId = match ? (match.pet_one_id === myPetId ? match.pet_two_id : match.pet_one_id) : null;
  const { data: other } = otherId ? await supabase.from("pets").select("pet_name").eq("id", otherId).maybeSingle() : { data: null };
  return { petName: other?.pet_name ?? "", scheduledAt: next.scheduled_at, marker: next.marker };
}

/** "sam. 4 oct. · 18:30" in the app's language. */
export function formatMeetingTime(iso: string | Date, language: "fr" | "en", long = false) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const locale = language === "en" ? "en-GB" : "fr-FR";
  const day = date.toLocaleDateString(locale, long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return long ? `${day} ${language === "en" ? "at" : "à"} ${time}` : `${day} · ${time}`;
}

export async function createMeetingProposal(input: Omit<MeetingProposal, "id" | "status" | "checkInExpiresAt" | "completedAt">) {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from("meeting_proposals")
    .insert({
      match_id: input.matchId,
      proposer_pet_id: input.proposerPetId,
      latitude: input.latitude,
      longitude: input.longitude,
      marker: input.marker,
      scheduled_at: input.scheduledAt,
      expires_at: input.expiresAt,
    })
    .select()
    .single();
  return { data: data ? toMeetingProposal(data) : null, error };
}

export async function respondToMeetingProposal(proposalId: string, accept: boolean) {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase.rpc("respond_to_meeting_proposal", {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  return { data: data ? toMeetingProposal(data) : null, error };
}

export async function getMeetingCheckInCode(proposalId: string) {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase.rpc("get_meeting_check_in_code", { p_proposal_id: proposalId });
  const result = Array.isArray(data) ? data[0] : null;
  return { data: result ? { code: result.code as string, expiresAt: result.expires_at as string } : null, error };
}

export async function confirmMeetingCheckIn(proposalId: string, code: string) {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase.rpc("confirm_meeting_check_in", {
    p_proposal_id: proposalId,
    p_code: code,
  });
  return { data: data ? toMeetingProposal(data) : null, error };
}

export async function loadMeetingTraces(ownerId: string, petId: number) {
  if (!supabase || !ownerId) return { data: [], error: null };
  const { data, error } = await supabase.from("meeting_traces").select("matched_pet_key, latitude, longitude, marker, status, requested_by").eq("owner_id", ownerId).eq("pet_key", String(petId));
  return {
    data: (data ?? []) as Array<Pick<MeetingTraceRow, "matched_pet_key" | "latitude" | "longitude" | "marker" | "status" | "requested_by">>,
    error,
  };
}

export async function saveMeetingTrace(ownerId: string, petId: number, matchedPetId: number, trace: MeetingTrace) {
  if (!supabase || !ownerId) return { error: null };
  const { error } = await supabase.from("meeting_traces").upsert({
    owner_id: ownerId,
    pet_key: String(petId),
    matched_pet_key: String(matchedPetId),
    latitude: trace.latitude,
    longitude: trace.longitude,
    marker: trace.marker,
    status: trace.status ?? "pending",
    requested_by: trace.requestedBy ?? "me",
  }, { onConflict: "owner_id,pet_key,matched_pet_key" });
  return { error };
}

export async function updateMeetingTraceStatus(ownerId: string, petId: number, matchedPetId: number, status: "pending" | "confirmed") {
  if (!supabase || !ownerId) return { error: null };
  const { error } = await supabase.from("meeting_traces").update({ status }).eq("owner_id", ownerId).eq("pet_key", String(petId)).eq("matched_pet_key", String(matchedPetId));
  return { error };
}

export async function removeMeetingTrace(ownerId: string, petId: number, matchedPetId: number) {
  if (!supabase || !ownerId) return { error: null };
  const { error } = await supabase.from("meeting_traces").delete().eq("owner_id", ownerId).eq("pet_key", String(petId)).eq("matched_pet_key", String(matchedPetId));
  return { error };
}
