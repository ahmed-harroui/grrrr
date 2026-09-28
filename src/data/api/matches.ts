import { Match } from "../types/match";
import { supabase } from "@/lib/supabase";

const matches: Match[] = [];

// Mock pets use numeric ids; only real (UUID) pets exist in the database.
const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function getMatches(
  petId: string
): Promise<Match[]> {
  if (supabase && isUuid(petId)) {
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

// True when the database already holds a match between the two pets
// (created server side when both liked each other, or instantly for test bots).
export async function matchExists(petA: string, petB: string): Promise<boolean> {
  if (!supabase || !isUuid(petA) || !isUuid(petB)) return false;
  const [one, two] = petA < petB ? [petA, petB] : [petB, petA];
  const { data } = await supabase.from("pet_matches").select("id").eq("pet_one_id", one).eq("pet_two_id", two).maybeSingle();
  return Boolean(data);
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