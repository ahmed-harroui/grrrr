import type { PetProgress } from "@/context/AppState";
import type { XpSourceKey } from "@/data/api/progress";

// XP needed to reach levels 1..6 — keep in sync with pet_level_for_xp() in migrations/005_pet_progression.sql.
export const LEVEL_THRESHOLDS = [0, 600, 1800, 4000, 8000, 14000];
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;
export const PET_RANKS = [
  { name: "Bronze", nameEn: "Bronze", color: "#B77A4A", image: require("../../assets/levels/bronze.png") },
  { name: "Argent", nameEn: "Silver", color: "#9AA6B2", image: require("../../assets/levels/silver.png") },
  { name: "Or", nameEn: "Gold", color: "#D9A62E", image: require("../../assets/levels/gold.png") },
  { name: "Vert", nameEn: "Green", color: "#42A66A", image: require("../../assets/levels/vert.png") },
  { name: "Rouge", nameEn: "Red", color: "#E05252", image: require("../../assets/levels/rouge.png") },
  { name: "Bleu", nameEn: "Blue", color: "#4C8DDE", image: require("../../assets/levels/bleu.png") },
];

// How each activity earns XP, shown as "quests" in the app.
export const XP_SOURCES: Record<XpSourceKey, { icon: string; title: string; titleEn: string; rule: string; ruleEn: string }> = {
  profile: { icon: "📝", title: "Profil au max", titleEn: "Complete profile", rule: "20 XP par info remplie, +120 XP quand tout est complet", ruleEn: "20 XP per filled field, +120 XP when everything is complete" },
  gallery: { icon: "📸", title: "Galerie photos", titleEn: "Photo gallery", rule: "10 XP par photo, jusqu'à 6", ruleEn: "10 XP per photo, up to 6" },
  matches: { icon: "💘", title: "Matchs", titleEn: "Matches", rule: "25 XP par match", ruleEn: "25 XP per match" },
  likes: { icon: "❤️", title: "Likes reçus", titleEn: "Likes received", rule: "4 XP par like reçu", ruleEn: "4 XP per like received" },
  messages: { icon: "💬", title: "Messages", titleEn: "Messages", rule: "1 XP par message envoyé, 2 XP par message reçu", ruleEn: "1 XP per message sent, 2 XP per message received" },
  meetings: { icon: "📍", title: "Rencontres validées", titleEn: "Verified meetups", rule: "80 XP par rencontre confirmée sur place", ruleEn: "80 XP per meetup confirmed on site" },
  weekly: { icon: "🔥", title: "Connexion hebdo", titleEn: "Weekly visit", rule: "15 XP par semaine, bonus qui grandit avec la série", ruleEn: "15 XP per week, with a bonus that grows with your streak" },
  treats: { icon: "🦴", title: "Croquettes", titleEn: "Treats", rule: "1 XP par croquette gagnée", ruleEn: "1 XP per treat earned" },
  care: { icon: "🩺", title: "GRRRR Care", titleEn: "GRRRR Care", rule: "150 XP en liant Care, + vaccins, visites, puce, poids", ruleEn: "150 XP for linking Care, + vaccines, visits, microchip, weight" },
  adoption: { icon: "🍼", title: "Adoption", titleEn: "Adoption", rule: "200 XP quand sa relation est acceptée, 20 XP par famille intéressée, 40 XP par demande d'adoption envoyée", ruleEn: "200 XP when their relationship is accepted, 20 XP per interested family, 40 XP per adoption request sent" },
};

export function levelFromXp(xp: number) {
  const level = Math.max(1, LEVEL_THRESHOLDS.filter((threshold) => xp >= threshold).length);
  const currentStart = LEVEL_THRESHOLDS[level - 1];
  const next = LEVEL_THRESHOLDS[level] ?? null;
  const rank = PET_RANKS[level - 1];
  return { xp, level, next, currentStart, rank, isMax: next === null, progress: next === null ? 1 : Math.min(1, (xp - currentStart) / (next - currentStart)) };
}

// Guest / demo mode only: rough local estimate with the same weights as the server.
export function getPetLevel(treats: number, progress: PetProgress, completion: number) {
  const xp = treats + progress.matches * 25 + progress.outings * 80 + progress.messagesReceived * 2 + Math.round(completion * 9) * 20 + (completion >= 1 ? 120 : 0);
  return levelFromXp(xp);
}
