import { supabase } from "@/lib/supabase";

// Real chat between matched pets, stored in match_messages (one conversation per pet_matches row).

export type DbMessage = { id: string; match_id: string; sender_pet_id: string; body: string; created_at: string };
export type Conversation = { matchId: string; otherPetId: string; messages: DbMessage[] };

const isUuid = (id?: string) => Boolean(id && /^[0-9a-f-]{36}$/i.test(id));

/** Every match of my pet with its messages, oldest first. */
export async function loadConversations(myPetId: string): Promise<Conversation[]> {
  if (!supabase || !isUuid(myPetId)) return [];
  const { data: matches, error } = await supabase
    .from("pet_matches")
    .select("id, pet_one_id, pet_two_id")
    .or(`pet_one_id.eq.${myPetId},pet_two_id.eq.${myPetId}`);
  if (error || !matches?.length) return [];
  const { data: messages } = await supabase
    .from("match_messages")
    .select("id, match_id, sender_pet_id, body, created_at")
    .in("match_id", matches.map((m) => m.id))
    .order("created_at", { ascending: true });
  return matches.map((m) => ({
    matchId: m.id,
    otherPetId: m.pet_one_id === myPetId ? m.pet_two_id : m.pet_one_id,
    messages: (messages ?? []).filter((msg) => msg.match_id === m.id) as DbMessage[],
  }));
}

export async function sendMatchMessage(matchId: string, senderPetId: string, body: string) {
  if (!supabase || !isUuid(matchId) || !isUuid(senderPetId)) return { error: null };
  const { error } = await supabase.from("match_messages").insert({ match_id: matchId, sender_pet_id: senderPetId, body });
  if (error) console.warn("Message not sent", error.message);
  return { error };
}

/** Calls onMessage for every new message in these conversations (needs match_messages in realtime). */
export function subscribeToMessages(matchIds: string[], onMessage: (message: DbMessage) => void) {
  if (!supabase || matchIds.length === 0) return () => {};
  const client = supabase;
  const channel = client
    .channel(`chat-${matchIds.slice(0, 3).join("-")}-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_messages", filter: `match_id=in.(${matchIds.join(",")})` }, (payload) => onMessage(payload.new as DbMessage))
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
