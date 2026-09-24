import { Pet } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";

export interface TrendingPet {
  pet: Pet;
  score: number;
  compatibility: number;
}

function dailySignal(petId: number) {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const seed = Number(today) + petId * 97;
  return (seed % 9) / 10;
}

export function rankTrendingPets(pets: Pet[], activePet: Pet, mode: number): TrendingPet[] {
  return pets
    .filter((pet) => pet.id !== activePet.id)
    .map((pet) => {
      const compatibility = computeMatch(pet, mode, activePet).pct;
      const sameSpeciesScore = pet.species === activePet.species ? 35 : 0;
      const proximityScore = Math.max(0, 20 - Math.min(pet.dist, 20));
      const levelScore = Math.min(pet.level ?? 1, 6) * 2;
      const freshnessScore = dailySignal(pet.id) * 8;

      return {
        pet,
        compatibility,
        score: compatibility * 0.55 + sameSpeciesScore + proximityScore + levelScore + freshnessScore,
      };
    })
    .sort((a, b) => b.score - a.score || b.compatibility - a.compatibility || a.pet.dist - b.pet.dist);
}
