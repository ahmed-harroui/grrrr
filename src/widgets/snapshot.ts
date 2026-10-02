import type { Pet } from "@/data/mockPets";
import type { CareStatus } from "@/data/api/care";
import type { Language } from "@/i18n/translations";
import { pick } from "@/i18n/useTranslation";
import { levelFromXp } from "@/utils/petProgression";
import { SPECIES } from "@/components/AddPetSheet";
import { formatMeetingTime } from "@/data/api/meetings";

// What the home-screen widgets show. The app builds it (texts already in the user's
// language) and hands it to the widgets, which only draw it: they can't reach the app's state.

export interface WidgetSnapshot {
  updatedAt: string;
  /** For refreshing the numbers while the app is closed (src/widgets/liveRefresh.ts) */
  language?: Language;
  petDbId?: string;
  pet: {
    /** 1..6: the rank emblem drawn instead of a "Lvl" label */
    rankLevel?: number;
    name: string;
    /** Avatar URL (Android loads it directly; iOS uses photoFile) */
    photo: string;
    /** iOS: the avatar copied into the folder shared with the widgets */
    photoFile?: string;
    icon: string;
    /** The rank's name ("Or"): the emblem says the level */
    rank: string;
    rankColor: string;
    /** "1 240 / 1 800 XP" */
    xp: string;
    /** 0..1 towards the next level */
    progress: number;
    treats: string;
    streak: string;
    mood: string;
    hot: boolean;
  };
  social: {
    title: string;
    likes: number;
    likesLabel: string;
    matches: number;
    matchesLabel: string;
    unread: number;
    unreadLabel: string;
    /** "Praline a liké Rocky 👀" or an invitation to swipe */
    headline: string;
  };
  ranking: {
    title: string;
    rows: { position: string; name: string; xp: string; mine: boolean }[];
    /** "Rocky est #7" */
    mine: string;
  };
  day: { icon: string; title: string; body: string };
}

export const WIDGET_SNAPSHOT_KEY = "grrrr.widget.snapshot";

/** Screens the widgets open (see the linking config in RootNavigator). */
export const WIDGET_LINKS = { pet: "grrrr://pet", matches: "grrrr://matches", discover: "grrrr://discover", chat: "grrrr://chat", explore: "grrrr://explore", notifications: "grrrr://notifications" };

const FACTS: Record<"dog" | "cat" | "other", [string, string][]> = {
  dog: [
    ["La truffe d'un chien est unique, comme une empreinte digitale.", "A dog's nose print is unique, like a fingerprint."],
    ["Un chien comprend en moyenne 150 mots. « Balade » est souvent le préféré.", "A dog understands about 150 words. \"Walk\" is often the favourite."],
    ["Les chiens transpirent surtout par les coussinets.", "Dogs sweat mostly through their paw pads."],
    ["Remuer la queue vers la droite : un chien plutôt content.", "A tail wagging to the right: a rather happy dog."],
    ["L'odorat d'un chien est des milliers de fois plus fin que le nôtre.", "A dog's sense of smell is thousands of times sharper than ours."],
    ["Bâiller est contagieux aussi entre un chien et son humain.", "Yawning is contagious between a dog and their human too."],
  ],
  cat: [
    ["Un chat dort entre 12 et 16 heures par jour.", "A cat sleeps 12 to 16 hours a day."],
    ["Le ronronnement apaise aussi le chat lui-même.", "Purring also soothes the cat itself."],
    ["Un chat cligne lentement des yeux pour dire qu'il a confiance.", "A cat blinks slowly to say it trusts you."],
    ["Les moustaches d'un chat mesurent la largeur des passages.", "A cat's whiskers measure the width of openings."],
    ["Un chat peut tourner chaque oreille séparément.", "A cat can turn each ear separately."],
    ["Les chats ne goûtent pas le sucré.", "Cats can't taste sweetness."],
  ],
  other: [
    ["Un compagnon stimulé chaque jour est un compagnon plus serein.", "A companion stimulated every day is a calmer companion."],
    ["Les routines rassurent la plupart des animaux.", "Routines reassure most animals."],
    ["Quelques minutes de jeu par jour renforcent le lien avec ton compagnon.", "A few minutes of play a day strengthen the bond with your companion."],
    ["De l'eau fraîche à volonté : le geste santé le plus simple.", "Fresh water at all times: the simplest health habit."],
  ],
};

const formatNumber = (value: number, language: Language) => Math.round(value).toLocaleString(language === "en" ? "en-GB" : "fr-FR");

/** Days until the next birthday (0 = today), or null without a valid date. */
function daysUntilBirthday(birthday: string | null | undefined, now: Date) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [, month, day] = birthday.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next.getTime() - today.getTime()) / 864e5);
}

export interface SnapshotInput {
  language: Language;
  pet: Pet;
  xp: number;
  treats: number;
  weeksStreak: number;
  likes: number;
  lastLikerName?: string;
  matches: number;
  unread: number;
  /** Pets sorted by XP, the best first */
  ranking: Pet[];
  care: CareStatus | null;
  /** The next confirmed outing (migration 017) */
  nextOuting?: { petName: string; scheduledAt: string } | null;
  now?: Date;
}

/** The word of the day: a birthday today, an outing soon, a birthday this month, a health tip, or a fact. */
export function dayMessage(input: { language: Language; pet: Pet; care: CareStatus | null; nextOuting?: { petName: string; scheduledAt: string } | null; now: Date }) {
  const { language, pet, care, nextOuting, now } = input;
  const tx = (fr: string, en: string) => pick(language, fr, en);
  const birthdayIn = daysUntilBirthday(pet.health?.birthday, now);
  const outingIn = nextOuting ? new Date(nextOuting.scheduledAt).getTime() - now.getTime() : null;
  const facts = FACTS[pet.species === "dog" || pet.species === "cat" ? pet.species : "other"];
  const fact = facts[Math.floor(now.getTime() / 864e5) % facts.length];
  if (birthdayIn === 0) return { icon: "🎂", title: tx(`Joyeux anniversaire ${pet.name} !`, `Happy birthday ${pet.name}!`), body: tx("Une croquette de plus et une belle balade pour fêter ça.", "An extra treat and a nice walk to celebrate.") };
  if (nextOuting && outingIn !== null && outingIn > 0 && outingIn < 3 * 864e5) {
    return { icon: "📍", title: tx(`Sortie avec ${nextOuting.petName}`, `Outing with ${nextOuting.petName}`), body: tx(`${formatMeetingTime(nextOuting.scheduledAt, language, true)}. Le lieu est sur la carte.`, `${formatMeetingTime(nextOuting.scheduledAt, language, true)}. The spot is on the map.`) };
  }
  if (birthdayIn !== null && birthdayIn <= 30) return { icon: "🎂", title: tx(`Anniversaire de ${pet.name}`, `${pet.name}'s birthday`), body: tx(`Dans ${birthdayIn} jour${birthdayIn > 1 ? "s" : ""}. Prépare-lui quelque chose !`, `In ${birthdayIn} day${birthdayIn > 1 ? "s" : ""}. Get something ready!`) };
  if (care?.status === "ok" && care.advice && care.level !== "good") return { icon: "🩺", title: tx(`Santé de ${pet.name}`, `${pet.name}'s health`), body: tx(care.advice.fr, care.advice.en) };
  return { icon: "🧠", title: tx("Le savais-tu ?", "Did you know?"), body: tx(fact[0], fact[1]) };
}

export function buildWidgetSnapshot(input: SnapshotInput): WidgetSnapshot {
  const { language, pet } = input;
  const tx = (fr: string, en: string) => pick(language, fr, en);
  const now = input.now ?? new Date();
  const level = levelFromXp(input.xp);
  const hot = pet.mode >= 50;

  const position = input.ranking.findIndex((item) => (pet.dbId ? item.dbId === pet.dbId : item.id === pet.id));
  const rows = input.ranking.slice(0, 3).map((item, index) => ({
    position: ["🥇", "🥈", "🥉"][index],
    name: item.name,
    xp: `${formatNumber(item.xp ?? 0, language)} XP`,
    mine: index === position,
  }));

  const day = dayMessage({ language, pet, care: input.care, nextOuting: input.nextOuting, now });

  return {
    updatedAt: now.toISOString(),
    language,
    petDbId: pet.dbId,
    pet: {
      name: pet.name,
      photo: pet.photo,
      icon: SPECIES.find((item) => item.key === pet.species)?.icon ?? "🐾",
      rankLevel: level.level,
      rank: tx(level.rank.name, level.rank.nameEn),
      rankColor: level.rank.color,
      xp: level.next === null ? `${formatNumber(input.xp, language)} XP · max` : `${formatNumber(input.xp, language)} / ${formatNumber(level.next, language)} XP`,
      progress: level.progress,
      treats: `🦴 ${formatNumber(input.treats, language)} ${tx("croquettes", "treats")}`,
      streak: input.weeksStreak > 0 ? `🔥 ${input.weeksStreak} ${tx(input.weeksStreak > 1 ? "semaines" : "semaine", input.weeksStreak > 1 ? "weeks" : "week")}` : tx("🔥 Série à lancer", "🔥 Start a streak"),
      mood: hot ? "✦ Hot" : "🐾 Friend",
      hot,
    },
    social: {
      title: tx(`Les rencontres de ${pet.name}`, `${pet.name}'s encounters`),
      likes: input.likes,
      likesLabel: tx("likes reçus", "likes received"),
      matches: input.matches,
      matchesLabel: tx(input.matches > 1 ? "matchs" : "match", input.matches > 1 ? "matches" : "match"),
      unread: input.unread,
      unreadLabel: tx(input.unread > 1 ? "messages" : "message", input.unread > 1 ? "messages" : "message"),
      headline:
        input.unread > 0 ? tx(`💬 ${input.unread} message${input.unread > 1 ? "s" : ""} à lire`, `💬 ${input.unread} message${input.unread > 1 ? "s" : ""} to read`)
        : input.likes > 0 && input.lastLikerName ? tx(`💌 ${input.lastLikerName} a liké ${pet.name} 👀`, `💌 ${input.lastLikerName} liked ${pet.name} 👀`)
        : input.likes > 0 ? tx(`💌 ${input.likes} like${input.likes > 1 ? "s" : ""} à découvrir`, `💌 ${input.likes} like${input.likes > 1 ? "s" : ""} to discover`)
        : tx("Swipe dans Discover pour de nouvelles rencontres 🐾", "Swipe in Discover to meet new friends 🐾"),
    },
    ranking: {
      title: tx("🏆 Classement XP", "🏆 XP ranking"),
      rows,
      mine: position >= 0 ? tx(`${pet.name} est #${position + 1}`, `${pet.name} is #${position + 1}`) : tx(`${pet.name} n'est pas encore classé`, `${pet.name} isn't ranked yet`),
    },
    day,
  };
}
