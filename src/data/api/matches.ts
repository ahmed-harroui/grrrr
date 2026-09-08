import { Match } from "../types/match";

const matches: Match[] = [];

export async function getMatches(
  petId: string
): Promise<Match[]> {
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