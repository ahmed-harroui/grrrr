import { Match } from "../types/match";
import { supabase } from "@/lib/supabase";

const matches: Match[] = [];

export async function getMatches(
  petId: string
): Promise<Match[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("pet_matches")
      .select("id, pet_one_id, pet_two_id, match_type, created_at")
      .or(`pet_one_id.eq.${petId},pet_two_id.eq.${petId}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((match) => ({
      id: match.id,
      pet1Id: match.pet_one_id,
      pet2Id: match.pet_two_id,
      type: match.match_type,
      compatibilityScore: 0,
      createdAt: match.created_at,
    }));
  }

  return Promise.resolve(
    matches.filter(
      (match) =>
        match.pet1Id === petId ||
        match.pet2Id === petId
    )
  );
}

export async function createMatch(
  pet1Id: string,
  pet2Id: string,
  score: number,
  type: Match["type"]
): Promise<Match> {
  const match: Match = {
    id: `match_${Date.now()}`,

    pet1Id,
    pet2Id,

    type,

    compatibilityScore: score,

    createdAt: new Date().toISOString(),
  };

  matches.push(match);

  return Promise.resolve(match);
}