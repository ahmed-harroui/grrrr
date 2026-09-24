import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LIKED_BACK, ME, Pet } from "@/data/mockPets";
import { awardTreats, loadTreatBalance } from "@/data/api/treats";
import { loadMeetingTraces, removeMeetingTrace, saveMeetingTrace, updateMeetingTraceStatus } from "@/data/api/meetings";
import { getMatches, createMatch } from "@/data/api/matches";
import { createSwipe, getSwipeHistory } from "@/data/api/swipes";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

export interface ChatMessage {
  from: "me" | "them";
  text: string;
  read?: boolean;
}

export interface Chat {
  pet: Pet;
  messages: ChatMessage[];
}

export type MeetingMarker = "pink" | "blue";
export interface MeetingTrace {
  latitude: number;
  longitude: number;
  marker: MeetingMarker;
  status?: "pending" | "confirmed";
  requestedBy?: "me" | "them";
}

export interface PetProgress {
  matches: number;
  outings: number;
  messagesReceived: number;
  sessions: number;
}

interface PetSessionData {
  matches: Pet[];
  chats: Chat[];
  meetingMarkers: Record<number, MeetingMarker | undefined>;
  meetingTraces: Record<number, MeetingTrace | undefined>;
}

interface AppStateShape {
  activePet: Pet;
  setActivePet: (pet: Pet) => void;
  mode: number; // 0..100, 0 = FRIEND, 100 = HOT/LOVE
  setMode: (v: number) => void;
  matches: Pet[];
  chats: Chat[];
  pendingMatch: Pet | null;
  clearPendingMatch: () => void;
  likePet: (pet: Pet) => void;
  sendMessage: (petId: number, text: string) => void;
  markChatRead: (petId: number) => void;
  meetingMarkers: Record<number, MeetingMarker | undefined>;
  setMeetingMarker: (petId: number, marker: MeetingMarker) => void;
  meetingTraces: Record<number, MeetingTrace | undefined>;
  setMeetingTrace: (petId: number, trace: MeetingTrace) => void;
  confirmMeetingTrace: (petId: number) => void;
  deleteMeetingTrace: (petId: number) => void;
  treats: number;
  petProgress: PetProgress;
  progressByPet: Record<number, PetProgress>;
}

const AppStateContext = createContext<AppStateShape | undefined>(undefined);

const AUTO_REPLIES = [
  "Trop bien 🐾",
  "On se fait une balade ce week-end ?",
  "Haha j'adore !",
  `${ME.name} a l'air adorable 😍`,
];

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [activePet, setActivePetState] = useState<Pet>(ME);
  const [mode, setMode] = useState(ME.mode);
  const [matches, setMatches] = useState<Pet[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [pendingMatch, setPendingMatch] = useState<Pet | null>(null);
  const [meetingMarkers, setMeetingMarkers] = useState<Record<number, MeetingMarker | undefined>>({});
  const [meetingTraces, setMeetingTraces] = useState<Record<number, MeetingTrace | undefined>>({});
  const [treats, setTreats] = useState(0);
  const [claimedTreatKeys, setClaimedTreatKeys] = useState<Set<string>>(new Set());
  const [likedPetIds, setLikedPetIds] = useState<Set<number>>(new Set());
  const [progressByPet, setProgressByPet] = useState<Record<number, PetProgress>>({});
  const [petSessions, setPetSessions] = useState<Record<number, PetSessionData>>({});

  const petProgress = progressByPet[activePet.id] ?? { matches: 0, outings: 0, messagesReceived: 0, sessions: 0 };

  const updateProgress = useCallback((petId: number, update: Partial<PetProgress>) => {
    setProgressByPet((current) => ({
      ...current,
      [petId]: { ...(current[petId] ?? { matches: 0, outings: 0, messagesReceived: 0, sessions: 0 }), ...update },
    }));
  }, []);

  React.useEffect(() => {
    loadTreatBalance(String(activePet.id)).then(({ balance }) => setTreats(balance));
    updateProgress(activePet.id, { sessions: (progressByPet[activePet.id]?.sessions ?? 0) + 1 });
    if (session?.user.id) {
      loadMeetingTraces(session.user.id, activePet.id).then(({ data }) => {
        setMeetingTraces((current) => ({
          ...current,
          ...Object.fromEntries(data.map((trace) => [Number(trace.matched_pet_key), { latitude: trace.latitude, longitude: trace.longitude, marker: trace.marker, status: trace.status, requestedBy: trace.requested_by }])) as Record<number, MeetingTrace>,
        }));
      });
      (async () => {
        try {
          const matchesData = await getMatches(String(activePet.id));
          const matchPetIds = new Set(matchesData.map((m) => Number(m.pet1Id === String(activePet.id) ? m.pet2Id : m.pet1Id)));
          setLikedPetIds(matchPetIds);

          const matchedPets = await Promise.all(
            matchesData.map(async (m) => {
              const petId = Number(m.pet1Id === String(activePet.id) ? m.pet2Id : m.pet1Id);
              const pet = (await getSwipeHistory(String(petId)))[0];
              return pet;
            })
          );
        } catch (error) {
          console.error("Error loading matches:", error);
        }
      })();
    }
  }, [activePet.id, session?.user.id, updateProgress]);

  const collectTreats = useCallback(async (amount: number, reason: "match" | "outing", contextKey: string) => {
    if (claimedTreatKeys.has(contextKey)) return;
    setClaimedTreatKeys((current) => new Set(current).add(contextKey));
    const result = await awardTreats(String(activePet.id), amount, reason, contextKey);
    if (result.awarded) setTreats((current) => result.balance ?? current + amount);
  }, [activePet.id, claimedTreatKeys]);

  const setActivePet = useCallback((pet: Pet) => {
    if (pet.id === activePet.id) return;
    setPetSessions((current) => ({
      ...current,
      [activePet.id]: { matches, chats, meetingMarkers, meetingTraces },
    }));
    const savedSession = petSessions[pet.id];
    setActivePetState(pet);
    setMode(pet.mode);
    setMatches(savedSession?.matches ?? []);
    setChats(savedSession?.chats ?? []);
    setMeetingMarkers(savedSession?.meetingMarkers ?? {});
    setMeetingTraces(savedSession?.meetingTraces ?? {});
    setPendingMatch(null);
  }, [activePet.id, chats, matches, meetingMarkers, meetingTraces, petSessions]);

  const updateMode = useCallback((nextMode: number) => {
    setMode(nextMode);
    setActivePetState((current) => ({ ...current, mode: nextMode }));
  }, []);

  const likePet = useCallback(async (pet: Pet) => {
    setLikedPetIds((current) => new Set(current).add(pet.id));

    try {
      await createSwipe(String(activePet.id), String(pet.id), "like");
    } catch (error) {
      console.error("Error saving swipe:", error);
    }

    const hasLikedBack = likedPetIds.has(pet.id) || LIKED_BACK.has(pet.id);
    if (!hasLikedBack) return;

    const isHotMatch = activePet.mode >= 50 && pet.mode >= 50;
    const matchType = isHotMatch ? "Hot" : "Friend";
    const matchEmoji = isHotMatch ? "❤️" : "🐾";
    setMatches((prev) => (prev.find((p) => p.id === pet.id) ? prev : [...prev, pet]));
    setChats((prev) =>
      prev.find((c) => c.pet.id === pet.id)
        ? prev
        : [
            ...prev,
            {
              pet,
              messages: [{ from: "them", text: `Salut ! ${activePet.name} et ${pet.name} se sont plu 🐾\n\n${matchEmoji} Match ${matchType} ✦`, read: false }],
            },
          ]
    );
    setPendingMatch({ ...pet, matchType } as any);
    updateProgress(activePet.id, { matches: petProgress.matches + 1 });
    void collectTreats(10, "match", `match:${activePet.id}:${pet.id}`);

    try {
      await createMatch(String(activePet.id), String(pet.id), 0, matchType.toLowerCase());
    } catch (error) {
      console.error("Error creating match:", error);
    }
  }, [activePet.id, activePet.name, activePet.mode, collectTreats, likedPetIds, petProgress.matches, updateProgress]);

  const clearPendingMatch = useCallback(() => setPendingMatch(null), []);

  const sendMessage = useCallback((petId: number, text: string) => {
    if (!text.trim()) return;
    setChats((prev) =>
      prev.map((c) => (c.pet.id === petId ? { ...c, messages: [...c.messages, { from: "me", text }] } : c))
    );
    if (isSupabaseConfigured) return;

    setTimeout(() => {
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      setChats((prev) =>
        prev.map((c) =>
          c.pet.id === petId ? { ...c, messages: [...c.messages, { from: "them", text: reply }] } : c
        )
      );
      updateProgress(activePet.id, { messagesReceived: petProgress.messagesReceived + 1 });
    }, 900);
  }, [activePet.id, petProgress.messagesReceived, updateProgress]);

  const markChatRead = useCallback((petId: number) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.pet.id === petId
          ? { ...chat, messages: chat.messages.map((message) => ({ ...message, read: true })) }
          : chat
      )
    );
  }, []);

  const setMeetingMarker = useCallback((petId: number, marker: MeetingMarker) => {
    setMeetingMarkers((prev) => ({ ...prev, [petId]: marker }));
    setMeetingTraces((prev) => {
      const existing = prev[petId];
      const lat = (typeof existing?.latitude === "number" && !isNaN(existing.latitude))
        ? existing.latitude
        : 48.8566 + ((petId % 5) * 0.003);
      const lng = (typeof existing?.longitude === "number" && !isNaN(existing.longitude))
        ? existing.longitude
        : 2.3522 + ((petId % 5) * 0.003);
      return {
        ...prev,
        [petId]: {
          latitude: lat,
          longitude: lng,
          marker,
          status: existing?.status ?? "pending",
          requestedBy: existing?.requestedBy ?? "me",
        },
      };
    });
    const modeText = marker === "pink" ? "Amoureux ❤️ (Hot)" : "Amical 🐾 (Friend)";
    const messageText = `📍 Sortie organisée : Rendez-vous ${modeText} sélectionné ! Retrouvons-nous sur la carte.`;
    setChats((prev) => {
      const existing = prev.find((c) => c.pet.id === petId);
      if (existing) {
        const lastMsg = existing.messages[existing.messages.length - 1];
        if (lastMsg?.text === messageText) return prev;
        return prev.map((c) =>
          c.pet.id === petId
            ? { ...c, messages: [...c.messages, { from: "me", text: messageText }] }
            : c
        );
      }
      const petMatch = matches.find((m) => m.id === petId);
      if (!petMatch) return prev;
      return [
        ...prev,
        {
          pet: petMatch,
          messages: [{ from: "me", text: messageText }],
        },
      ];
    });
  }, [matches]);

  const setMeetingTrace = useCallback((petId: number, trace: MeetingTrace) => {
    const lat = (typeof trace?.latitude === "number" && !isNaN(trace.latitude))
      ? trace.latitude
      : 48.8566 + ((petId % 5) * 0.003);
    const lng = (typeof trace?.longitude === "number" && !isNaN(trace.longitude))
      ? trace.longitude
      : 2.3522 + ((petId % 5) * 0.003);
    const nextTrace: MeetingTrace = {
      ...trace,
      latitude: lat,
      longitude: lng,
      marker: trace.marker ?? "pink",
      status: trace.status ?? "pending",
      requestedBy: trace.requestedBy ?? "me",
    };
    setMeetingTraces((prev) => ({ ...prev, [petId]: nextTrace }));
    setMeetingMarkers((prev) => ({ ...prev, [petId]: nextTrace.marker }));
    if (session?.user.id) void saveMeetingTrace(session.user.id, activePet.id, petId, nextTrace);
    updateProgress(activePet.id, { outings: petProgress.outings + 1 });
    void collectTreats(5, "outing", `outing:${activePet.id}:${petId}`);

    const modeText = nextTrace.marker === "pink" ? "Amoureux ❤️ (Hot)" : "Amical 🐾 (Friend)";
    const messageText = `📍 Sortie organisée : Rendez-vous ${modeText} sélectionné ! Retrouvons-nous sur la carte.`;
    setChats((prev) => {
      const existing = prev.find((c) => c.pet.id === petId);
      if (existing) {
        const lastMsg = existing.messages[existing.messages.length - 1];
        if (lastMsg?.text === messageText) return prev;
        return prev.map((c) =>
          c.pet.id === petId
            ? { ...c, messages: [...c.messages, { from: "me", text: messageText }] }
            : c
        );
      }
      const petMatch = matches.find((m) => m.id === petId);
      if (!petMatch) return prev;
      return [
        ...prev,
        {
          pet: petMatch,
          messages: [{ from: "me", text: messageText }],
        },
      ];
    });
  }, [activePet.id, collectTreats, matches, petProgress.outings, session?.user.id, updateProgress]);

  const confirmMeetingTrace = useCallback((petId: number) => {
    setMeetingTraces((prev) => prev[petId] ? { ...prev, [petId]: { ...prev[petId], status: "confirmed" } } : prev);
    if (session?.user.id) void updateMeetingTraceStatus(session.user.id, activePet.id, petId, "confirmed");
  }, [activePet.id, session?.user.id]);

  const deleteMeetingTrace = useCallback((petId: number) => {
    setMeetingTraces((prev) => { const next = { ...prev }; delete next[petId]; return next; });
    setMeetingMarkers((prev) => { const next = { ...prev }; delete next[petId]; return next; });
    if (session?.user.id) void removeMeetingTrace(session.user.id, activePet.id, petId);
  }, [activePet.id, session?.user.id]);

  const value = useMemo(
    () => ({ activePet, setActivePet, mode, setMode: updateMode, matches, chats, pendingMatch, clearPendingMatch, likePet, sendMessage, markChatRead, meetingMarkers, setMeetingMarker, meetingTraces, setMeetingTrace, confirmMeetingTrace, deleteMeetingTrace, treats, petProgress, progressByPet }),
    [activePet, setActivePet, mode, updateMode, matches, chats, pendingMatch, clearPendingMatch, likePet, sendMessage, markChatRead, meetingMarkers, setMeetingMarker, meetingTraces, setMeetingTrace, confirmMeetingTrace, deleteMeetingTrace, treats, petProgress, progressByPet]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
