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

export type MeetingProposalStatus = "pending" | "accepted" | "rejected" | "expired" | "completed";

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
