import { Pet } from "../types/pet";
import { MOCK_ME, MOCK_PETS } from "../mock/pets";
import { calculateCompatibility } from "../../utils/matching";

export interface DiscoveryPet extends Pet {
  compatibility: number;
  compatibilityReasons: string[];
}

export async function getDiscoverPets(
  currentPet: Pet = MOCK_ME
): Promise<DiscoveryPet[]> {
  const candidates = MOCK_PETS
    .filter((pet) => pet.id !== currentPet.id)
    .map((pet) => {
      const score = calculateCompatibility(
        currentPet,
        pet
      );

      return {
        ...pet,
        compatibility: score.total,
        compatibilityReasons: score.reasons,
      };
    })
    .sort(
      (a, b) =>
        b.compatibility - a.compatibility
    );

  return Promise.resolve(candidates);
}