import type { Pet } from "@/data/mockPets";

const normalize = (value?: string) =>
  (value ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** 0 = same city, 1 = same country, 2 = anywhere else. */
export function proximityRank(pet: Pet, me: Pet) {
  const city = normalize(me.city);
  const country = normalize(me.country);
  if (city && normalize(pet.city) === city) return 0;
  if (country && normalize(pet.country) === country) return 1;
  return 2;
}
