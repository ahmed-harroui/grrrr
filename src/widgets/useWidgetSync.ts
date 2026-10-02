import { useEffect } from "react";
import { Platform } from "react-native";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/AuthContext";
import { useLocalization } from "@/context/LocalizationContext";
import { getCareStatus } from "@/data/api/care";
import { getNextOuting } from "@/data/api/meetings";
import { getTopXpPetProfiles, petRecordToPet } from "@/data/api/profile";
import { refreshPetProgress } from "@/data/api/progress";
import { PETS } from "@/data/mockPets";
import { supabase } from "@/lib/supabase";
import { rankTrendingPets } from "@/utils/trending";
import { pushWidgets } from "@/widgets/native";
import { buildWidgetSnapshot } from "@/widgets/snapshot";

// Keeps the home-screen widgets up to date with the active pet: XP, croquettes, streak,
// likes, matches, unread messages, ranking and the word of the day.
export function useWidgetSync({ likes, lastLikerName, unread }: { likes: number; lastLikerName?: string; unread: number }) {
  const { activePet, matches, treats, meetingTraces } = useAppState();
  // An outing proposed, confirmed or cancelled: the word of the day may change.
  const outingsKey = Object.entries(meetingTraces).map(([petId, trace]) => `${petId}:${trace?.status ?? ""}`).join(",");
  const { session } = useAuth();
  const { language } = useLocalization();
  const matchCount = matches.length;

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    // Several values change together (a match adds croquettes and a chat): wait for them to settle.
    const timer = setTimeout(async () => {
      const petId = session ? activePet.dbId : undefined;
      const [progress, top, care, nextOuting] = await Promise.all([
        petId ? refreshPetProgress(petId, false) : null,
        session ? getTopXpPetProfiles(100) : null,
        petId ? getCareStatus(petId).catch(() => null) : null,
        petId ? getNextOuting(petId).catch(() => null) : null,
      ]);
      if (!active) return;
      const ranking = top?.data.length ? top.data.map(petRecordToPet) : rankTrendingPets(PETS);
      const snapshot = buildWidgetSnapshot({
        language,
        pet: activePet,
        xp: progress?.progression?.xp ?? activePet.xp ?? 0,
        treats,
        weeksStreak: progress?.progression?.weeks_streak ?? 0,
        likes,
        lastLikerName,
        matches: matchCount,
        unread,
        ranking,
        care,
        nextOuting,
      });
      await pushWidgets(snapshot).catch((error) => console.warn("Widgets not updated", error));
    }, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePet.dbId, activePet.name, activePet.photo, activePet.mode, language, lastLikerName, likes, matchCount, session?.user.id, treats, unread, outingsKey]);

  // Signed out: the widgets go back to their empty state.
  useEffect(() => {
    if (Platform.OS === "web" || !session?.user.id) return;
    return () => {
      void supabase?.auth.getSession().then(({ data }) => {
        if (!data.session) void pushWidgets(null).catch(() => {});
      });
    };
  }, [session?.user.id]);
}
