import type { PetProgress } from "@/context/AppState";

export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400];
export const PET_RANKS = [
  { name: "Bronze", color: "#B77A4A", image: require("../../assets/levels/bronze.png") },
  { name: "Argent", color: "#9AA6B2", image: require("../../assets/levels/silver.png") },
  { name: "Or", color: "#D9A62E", image: require("../../assets/levels/gold.png") },
  { name: "Vert", color: "#42A66A", image: require("../../assets/levels/vert.png") },
  { name: "Rouge", color: "#E05252", image: require("../../assets/levels/rouge.png") },
  { name: "Bleu", color: "#4C8DDE", image: require("../../assets/levels/bleu.png") },
];

export function getPetLevel(treats: number, progress: PetProgress, completion: number) {
  const xp = treats * 2 + progress.matches * 35 + progress.outings * 30 + progress.messagesReceived * 8 + progress.sessions * 5 + completion * 120;
  const level = Math.min(6, LEVEL_THRESHOLDS.filter((threshold) => xp >= threshold).length);
  const currentStart = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 500;
  const rank = PET_RANKS[Math.min(PET_RANKS.length - 1, level - 1)];
  return { xp, level, next, currentStart, rank, progress: Math.min(1, (xp - currentStart) / (next - currentStart)) };
}
