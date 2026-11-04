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

// XP is computed server side from real activity (see migrations/005_pet_progression.sql).
// visit = true also counts this week's connection for the streak. Never shown in the app:
// it ranks Discover and trending, and the admins see it on the dashboard (migration 032).
export async function refreshPetProgress(petId: string, visit = true): Promise<{ progression: PetProgression | null; error: string | null }> {
  if (!supabase || !isUuid(petId)) return { progression: null, error: null };
  const { data, error } = await supabase.rpc("refresh_pet_progress", { p_pet_id: petId, p_visit: visit });
  if (error) {
    console.warn("Pet progress could not be refreshed", error.message);
    return { progression: null, error: error.message };
  }
  return { progression: data as PetProgression, error: null };
}
