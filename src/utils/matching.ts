import { MOCK_ME, BREED_COMPATIBILITY } from "@/data/mock";
import type { Pet } from "@/data/types";

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
  pet: Pet,
  modeValue: number,
  me: Pet = MOCK_ME
): MatchResult {
  // Sécurité : évite le crash si un profil est manquant.
  if (!pet || !me) {
    return {
      pct: 0,
      reasons: ["🎾 Profil compatible"],
    };
  }

  const distance = calculateDistance(
    me.latitude,
    me.longitude,
    pet.latitude,
    pet.longitude
  );

  const breedScore = getBreedScore(me, pet);
  const distScore = getDistanceScore(distance);
  const ageScore = getAgeScore(me, pet);
  const energyScore = getEnergyScore(me, pet);
  const genderScore = getGenderScore(me, pet, modeValue);
  const modeScore = getModeScore(pet, modeValue);

  // IMPORTANT :
  // Chaque score est normalisé entre 0 et 1.
  // Les poids correspondent exactement à la logique originale.
  const total =
    breedScore * 0.3 +
    distScore * 0.2 +
    ageScore * 0.15 +
    energyScore * 0.15 +
    genderScore * 0.1 +
    modeScore * 0.1;

  const pct = Math.round(total * 100);

  const reasons: string[] = [];

  if (breedScore >= 0.7) {
    reasons.push(
      pet.breed === me.breed
        ? "🐾 Même race"
        : "🐾 Races compatibles"
    );
  }

  if (distance < 14) {
    reasons.push(`📍 ${distance.toFixed(1)} km`);
  }

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