import { supabase } from "@/lib/supabase";
import type { LikeIntent } from "@/data/types/swipe";
import type { MatchType } from "@/data/types/match";

// Pets that liked my pet but that it hasn't answered yet (a one-sided like, not a match).
// intent / super_like come with migration 009.
export type Liker = { id: string; photo_url: string; species: string; liked_at: string; intent?: LikeIntent; super_like?: boolean; pet_name?: string; breed?: string };

export async function getPetLikers(petId?: string): Promise<Liker[]> {
  if (!supabase || !petId || !/^[0-9a-f-]{36}$/i.test(petId)) return [];
  const { data, error } = await supabase.rpc("get_pet_likers", { p_pet_id: petId });
  if (error) {
    console.warn("Likers could not be loaded", error.message);
    return [];
  }
  const likers = (data ?? []) as Liker[];
  if (likers.length === 0) return likers;
  // Name and breed are shown next to the blurred photo.
  const { data: pets } = await supabase.from("pets").select("id, pet_name, breed").in("id", likers.map((liker) => liker.id));
  const byId = new Map((pets ?? []).map((pet) => [pet.id, pet]));
  return likers.map((liker) => ({ ...liker, pet_name: byId.get(liker.id)?.pet_name, breed: byId.get(liker.id)?.breed }));
}

/** Calls onMatch with the other pet's id and the match type whenever a new match involving my pet is created. */
export function subscribeToNewMatches(myPetId: string, onMatch: (otherPetId: string, type: MatchType) => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const handle = (payload: { new: Record<string, any> }) => {
    const row = payload.new;
    onMatch(row.pet_one_id === myPetId ? row.pet_two_id : row.pet_one_id, row.match_type ?? "BOTH");
  };
  const channel = client
    .channel(`matches-${myPetId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pet_matches", filter: `pet_one_id=eq.${myPetId}` }, handle)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pet_matches", filter: `pet_two_id=eq.${myPetId}` }, handle)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
