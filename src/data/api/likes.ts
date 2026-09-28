import { supabase } from "@/lib/supabase";

// Pets that liked my pet but that it hasn't answered yet (a one-sided like, not a match).
export type Liker = { id: string; photo_url: string; species: string; liked_at: string };

export async function getPetLikers(petId?: string): Promise<Liker[]> {
  if (!supabase || !petId || !/^[0-9a-f-]{36}$/i.test(petId)) return [];
  const { data, error } = await supabase.rpc("get_pet_likers", { p_pet_id: petId });
  if (error) {
    console.warn("Likers could not be loaded", error.message);
    return [];
  }
  return (data ?? []) as Liker[];
}

/** Calls onMatch with the other pet's id whenever a new match involving my pet is created. */
export function subscribeToNewMatches(myPetId: string, onMatch: (otherPetId: string) => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const handle = (payload: { new: Record<string, any> }) => {
    const row = payload.new;
    onMatch(row.pet_one_id === myPetId ? row.pet_two_id : row.pet_one_id);
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
