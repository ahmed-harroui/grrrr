import { Pet } from "@/data/mockPets";

/** Trending = the pets with the most XP, mine included (level breaks ties, e.g. demo pets without XP). */
export function rankTrendingPets(pets: Pet[]): Pet[] {
  return [...pets].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0) || (b.level ?? 1) - (a.level ?? 1));
}
