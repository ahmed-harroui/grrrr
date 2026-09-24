import { MOCK_ME, BREED_COMPATIBILITY } from "@/data/mock";
import type { Pet } from "@/data/types";
import type { Pet as LegacyPet } from "@/data/mockPets";

type MatchPet = Pet | LegacyPet;

function normalizePet(pet: MatchPet): Pet {
  if ("birthDate" in pet) return pet;
  return {
    id: String(pet.id),
    ownerId: "legacy-owner",
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    gender: pet.gender,
    birthDate: new Date(new Date().setFullYear(new Date().getFullYear() - pet.age)).toISOString(),
    energy: pet.energy,
    bio: pet.bio,
    tags: pet.tags,
    photos: [pet.photo],
    latitude: 48.8566,
    longitude: 2.3522 + pet.dist / 100,
    mode: pet.mode >= 50 ? "LOVE" : "FRIEND",
    modePreference: pet.mode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export interface MatchResult {
  pct: number;
  reasons: string[];
}

/**
 * Calcule l'âge d'un animal à partir de sa date de naissance.
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  const monthDiff = today.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * Calcule la distance entre deux coordonnées GPS.
 * Résultat en kilomètres.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Compatibilité de race.
 *
 * Même race = 100%
 * Race compatible = 70%
 * Autre race = 25%
 */
function getBreedScore(me: Pet, pet: Pet): number {
  if (!me || !pet) return 0;

  if (me.breed === pet.breed) {
    return 1;
  }

  const compatibility = BREED_COMPATIBILITY.find(
    (item) => item.breed === me.breed
  );

  if (compatibility?.compatibleBreeds.includes(pet.breed)) {
    return 0.7;
  }

  return 0.25;
}

/**
 * Compatibilité de distance.
 *
 * 0 km = 100%
 * 20 km ou plus = 0%
 */
function getDistanceScore(distance: number): number {
  return Math.max(0, 1 - distance / 20);
}

/**
 * Compatibilité d'âge.
 *
 * Même âge = 100%
 * 5 ans d'écart ou plus = 0%
 */
function getAgeScore(me: Pet, pet: Pet): number {
  const myAge = calculateAge(me.birthDate);
  const petAge = calculateAge(pet.birthDate);

  return Math.max(0, 1 - Math.abs(petAge - myAge) / 5);
}

/**
 * Compatibilité d'énergie.
 */
function getEnergyScore(me: Pet, pet: Pet): number {
  return Math.max(0, 1 - Math.abs(pet.energy - me.energy) / 3);
}

/**
 * Compatibilité du sexe.
 *
 * FRIEND : le sexe n'est pas important.
 * LOVE : préférence pour le sexe opposé.
 */
function getGenderScore(
  me: Pet,
  pet: Pet,
  modeValue: number
): number {
  if (modeValue < 50) {
    return 1;
  }

  return pet.gender !== me.gender ? 1 : 0.35;
}

/**
 * Compatibilité FRIEND ↔ LOVE.
 */
function getModeScore(pet: Pet, modeValue: number): number {
  return Math.max(0, 1 - Math.abs(pet.modePreference - modeValue) / 100);
}

function getSpeciesScore(me: Pet, pet: Pet): number {
  return me.species === pet.species ? 1 : 0.15;
}

/**
 * Calcule la compatibilité complète.
 *
 * Poids :
 * Race       30%
 * Distance   20%
 * Âge        15%
 * Énergie    15%
 * Sexe       10%
 * Mode       10%
 */
export function computeMatch(
  pet: MatchPet,
  modeValue: number,
  me: MatchPet = MOCK_ME
): MatchResult {
  // Sécurité : évite le crash si un profil est manquant.
  if (!pet || !me) {
    return {
      pct: 0,
      reasons: ["🎾 Profil compatible"],
    };
  }

  const normalizedMe = normalizePet(me);
  const normalizedPet = normalizePet(pet);
  const distance = calculateDistance(
    normalizedMe.latitude,
    normalizedMe.longitude,
    normalizedPet.latitude,
    normalizedPet.longitude
  );

  const speciesScore = getSpeciesScore(normalizedMe, normalizedPet);
  const breedScore = getBreedScore(normalizedMe, normalizedPet);
  const distScore = getDistanceScore(distance);
  const ageScore = getAgeScore(normalizedMe, normalizedPet);
  const energyScore = getEnergyScore(normalizedMe, normalizedPet);
  const genderScore = getGenderScore(normalizedMe, normalizedPet, modeValue);
  const modeScore = getModeScore(normalizedPet, modeValue);

  // IMPORTANT :
  // Chaque score est normalisé entre 0 et 1.
  // Les poids correspondent exactement à la logique originale.
  const total =
    speciesScore * 0.35 +
    breedScore * 0.2 +
    distScore * 0.2 +
    ageScore * 0.1 +
    energyScore * 0.1 +
    genderScore * 0.025 +
    modeScore * 0.025;

  const pct = Math.round(total * 100);

  const reasons: string[] = [];

  if (breedScore >= 0.7) {
    reasons.push(
      normalizedPet.breed === normalizedMe.breed
        ? "🐾 Même race"
        : "🐾 Races compatibles"
    );
  }

  if (distance < 14) {
    reasons.push(`📍 ${distance.toFixed(1)} km`);
  }

  if (speciesScore === 1) reasons.unshift(`🐾 Même espèce: ${normalizedPet.species}`);
  else reasons.push("🌍 Découverte d'une autre espèce");

  if (energyScore > 0.7) {
    reasons.push("⚡ Même niveau d'énergie");
  }

  if (modeScore > 0.7) {
    reasons.push(
      modeValue < 50
        ? "🐾 Cherche aussi un ami"
        : "❤️ Cherche aussi LOVE"
    );
  }

  if (genderScore >= 1 && modeValue >= 50) {
    reasons.push("❤️ Sexe compatible");
  }

  if (modeValue < 50) {
    reasons.push("🐾 Sexe sans importance");
  }

  if (ageScore > 0.7) {
    reasons.push("🎂 Âge compatible");
  }

  if (reasons.length === 0) {
    reasons.push("🎾 Profil compatible");
  }

  return {
    pct,
    reasons,
  };
}

export function calculateCompatibility(currentPet: Pet, candidate: Pet) {
  const result = computeMatch(candidate, currentPet.modePreference, currentPet);
  return { total: result.pct, reasons: result.reasons };
}