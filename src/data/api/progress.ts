import { supabase } from "@/lib/supabase";

export type XpSourceKey = "profile" | "gallery" | "matches" | "likes" | "messages" | "meetings" | "weekly" | "treats" | "care" | "adoption";

export type XpSource = {
  key: XpSourceKey;
  xp: number;
  /** Most XP this source can give; null = no limit */
  max: number | null;
  count: number;
  goal: number | null;
};

export type PetProgression = {
  xp: number;
  level: number;
  weeks_streak: number;
  care_linked: boolean;
  sources: XpSource[];
};

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// Notified with the fresh level after every successful refresh (used for the level-up animation).
// replay = true shows the animation even if this level was already celebrated.
type LevelListener = (petId: string, level: number, replay: boolean) => void;
const levelListeners = new Set<LevelListener>();
export function onPetLevel(listener: LevelListener) {
  levelListeners.add(listener);
  return () => {
    levelListeners.delete(listener);
  };
}

export function replayLevelCelebration(petId: string, level: number) {
  levelListeners.forEach((listener) => listener(petId, level, true));
}

// XP is computed server side from real activity (see migrations/005_pet_progression.sql).
// visit = true also counts this week's connection for the streak.
export async function refreshPetProgress(petId: string, visit = true): Promise<{ progression: PetProgression | null; error: string | null }> {
  if (!supabase || !isUuid(petId)) return { progression: null, error: null };
  const { data, error } = await supabase.rpc("refresh_pet_progress", { p_pet_id: petId, p_visit: visit });
  if (error) {
    console.warn("Pet progress could not be refreshed", error.message);
    return { progression: null, error: error.message };
  }
  const progression = data as PetProgression;
  levelListeners.forEach((listener) => listener(petId, progression.level, false));
  return { progression, error: null };
}
