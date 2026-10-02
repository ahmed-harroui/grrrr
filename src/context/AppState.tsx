import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { LIKED_BACK, ME, Pet } from "@/data/mockPets";
import { awardTreats, loadTreatBalance } from "@/data/api/treats";
import { getLiveMeetings, loadMeetingTraces, removeMeetingTrace, saveMeetingTrace, updateMeetingTraceStatus } from "@/data/api/meetings";
import { getMatches, createMatch, getMatchType } from "@/data/api/matches";
import type { MatchType } from "@/data/types/match";
import { createSwipe } from "@/data/api/swipes";
import { getOwnedPetProfiles, getPetsByIds, petRecordToPet, stablePetId } from "@/data/api/profile";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { refreshPetProgress } from "@/data/api/progress";
import { Conversation, loadConversations, sendMatchMessage, subscribeToMessages } from "@/data/api/chat";
import { subscribeToNewMatches } from "@/data/api/likes";

// Database pets are addressed by their UUID; demo pets by their numeric id.
const apiPetId = (pet: Pet) => pet.dbId ?? String(pet.id);

// LOVE (both liked in Hot) is a Hot match, FRIEND a Friend match. BOTH is a mixed-mood match,
// or one made before likes had a mood: the pets' own modes decide.
const matchLabel = (type: MatchType, me: Pet, other: Pet): "Hot" | "Friend" =>
  type === "LOVE" ? "Hot" : type === "FRIEND" ? "Friend" : me.mode >= 50 && other.mode >= 50 ? "Hot" : "Friend";

export interface ChatMessage {
  from: "me" | "them";
  text: string;
  read?: boolean;
}

export interface Chat {
  pet: Pet;
  messages: ChatMessage[];
  /** Last activity (new match or message): Messages lists the most recent first */
  lastAt?: string;
}

const now = () => new Date().toISOString();
const latest = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b);

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
  /** Pets owned by the signed-in account (empty in demo/guest mode) */
  ownedPets: Pet[];
  refreshOwnedPets: () => Promise<Pet[]>;
  mode: number; // 0..100, 0 = FRIEND, 100 = HOT/LOVE
  setMode: (v: number) => void;
  matches: Pet[];
  chats: Chat[];
  pendingMatch: Pet | null;
  clearPendingMatch: () => void;
  likePet: (pet: Pet, superLike?: boolean) => void;
  sendMessage: (petId: number, text: string) => void;
  markChatRead: (petId: number) => void;
  /** Reloads the database conversations (new ones, and messages written by the database) */
  refreshConversations: () => Promise<void>;
  meetingMarkers: Record<number, MeetingMarker | undefined>;
  setMeetingMarker: (petId: number, marker: MeetingMarker) => void;
  meetingTraces: Record<number, MeetingTrace | undefined>;
  setMeetingTrace: (petId: number, trace: MeetingTrace) => void;
  confirmMeetingTrace: (petId: number) => void;
  deleteMeetingTrace: (petId: number) => void;
  treats: number;
  /** Reads the active pet's treats again (after a daily gift) */
  refreshTreats: () => void;
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
  const [ownedPets, setOwnedPets] = useState<Pet[]>([]);
  // Database conversation id per matched pet (keyed by the pet's numeric id).
  const [matchIds, setMatchIds] = useState<Record<number, string>>({});
  const matchIdsRef = useRef(matchIds);
  matchIdsRef.current = matchIds;

  // Loads every database match of the active pet with its messages into matches + chats.
  const loadDbConversations = useCallback(async (myDbId: string) => {
    const conversations = await loadConversations(myDbId);
    if (!conversations.length) return;
    const { data: records } = await getPetsByIds(conversations.map((c) => c.otherPetId));
    const petsByDbId = new Map(records.map((record) => [record.id, petRecordToPet(record)]));
    const loaded = conversations
      .map((c) => ({ conversation: c, pet: petsByDbId.get(c.otherPetId) }))
      .filter((entry): entry is { conversation: Conversation; pet: Pet } => Boolean(entry.pet));
    setMatchIds((current) => ({ ...current, ...Object.fromEntries(loaded.map(({ conversation, pet }) => [pet.id, conversation.matchId])) }));
    setMatches((current) => [...current, ...loaded.map((l) => l.pet).filter((pet) => !current.some((existing) => existing.id === pet.id))]);
    setChats((current) => {
      const next = [...current];
      for (const { conversation, pet } of loaded) {
        const messages: ChatMessage[] = conversation.messages.map((m) => ({ from: m.sender_pet_id === myDbId ? "me" : "them", text: m.body, read: true }));
        // Last activity: the latest message, or the match itself.
        const lastAt = conversation.messages[conversation.messages.length - 1]?.created_at ?? conversation.createdAt;
        const index = next.findIndex((chat) => chat.pet.id === pet.id);
        if (index >= 0) next[index] = { pet, messages: messages.length ? messages : next[index].messages, lastAt: latest(next[index].lastAt, lastAt) };
        else next.push({ pet, messages, lastAt });
      }
      return next;
    });

    // Outings shared by both owners (migration 017): their spots on the map, on both sides.
    const live = await getLiveMeetings(loaded.map(({ conversation }) => conversation.matchId));
    const liveByMatch = new Map(live.map((proposal) => [proposal.matchId, proposal]));
    const traces: Record<number, MeetingTrace | undefined> = {};
    for (const { conversation, pet } of loaded) {
      const proposal = liveByMatch.get(conversation.matchId);
      traces[pet.id] = proposal
        ? { latitude: proposal.latitude, longitude: proposal.longitude, marker: proposal.marker, status: proposal.status === "accepted" ? "confirmed" : "pending", requestedBy: proposal.proposerPetId === myDbId ? "me" : "them" }
        : undefined;
    }
    setMeetingTraces((current) => ({ ...current, ...traces }));
    setMeetingMarkers((current) => ({ ...current, ...Object.fromEntries(Object.entries(traces).map(([petId, trace]) => [petId, trace?.marker])) }));
  }, []);

  // After a relation or adoption action: the database wrote the message, the chats follow.
  const refreshConversations = useCallback(async () => {
    if (activePet.dbId) await loadDbConversations(activePet.dbId);
  }, [activePet.dbId, loadDbConversations]);

  // Saves a message in the database conversation with this pet (when there is one).
  const persistMessage = useCallback((petId: number, text: string) => {
    const matchId = matchIdsRef.current[petId];
    if (matchId && activePet.dbId) void sendMatchMessage(matchId, activePet.dbId, text);
  }, [activePet.dbId]);

  // Pets this device just liked: their match is announced by likePet, not by the live listener.
  const recentlyLikedRef = useRef<Set<string>>(new Set());

  // A pet I liked earlier likes back: the match is created server side and announced here, live.
  React.useEffect(() => {
    const myDbId = activePet.dbId;
    if (!session?.user.id || !myDbId) return;
    return subscribeToNewMatches(myDbId, async (otherId, type) => {
      // An adoption request opens a conversation, without the match celebration.
      if (type === "ADOPT") {
        void loadDbConversations(myDbId);
        return;
      }
      if (recentlyLikedRef.current.has(otherId)) return;
      const { data } = await getPetsByIds([otherId]);
      if (!data[0]) return;
      const other = petRecordToPet(data[0]);
      setPendingMatch({ ...other, matchType: matchLabel(type, activePet, other) } as any);
      void loadDbConversations(myDbId);
    });
  }, [activePet.dbId, activePet.mode, loadDbConversations, session?.user.id]);

  // New messages from the other pets arrive in real time.
  React.useEffect(() => {
    const myDbId = activePet.dbId;
    const ids = Object.values(matchIds);
    if (!myDbId || ids.length === 0) return;
    const petByMatch = new Map(Object.entries(matchIds).map(([petId, matchId]) => [matchId, Number(petId)]));
    return subscribeToMessages(ids, (message) => {
      if (message.sender_pet_id === myDbId) return;
      const petId = petByMatch.get(message.match_id);
      if (petId === undefined) return;
      setChats((prev) => prev.map((chat) => (chat.pet.id === petId ? { ...chat, messages: [...chat.messages, { from: "them", text: message.body, read: false }], lastAt: message.created_at ?? now() } : chat)));
    });
  }, [activePet.dbId, matchIds]);

  const refreshOwnedPets = useCallback(async () => {
    if (!session?.user.id) return [];
    const { data, error } = await getOwnedPetProfiles(session.user.id);
    if (error) console.error("Error loading pets:", error);
    const pets = data.map(petRecordToPet);
    setOwnedPets(pets);
    // Keep the current pet if it belongs to the account, otherwise switch to its first pet.
    const next = pets.find((pet) => pet.id === activePet.id) ?? pets[0];
    if (next) {
      setActivePetState(next);
      if (next.id !== activePet.id) setMode(next.mode);
    }
    return pets;
  }, [activePet.id, session?.user.id]);

  // Signed in: load the account's own pets. Signed out: back to a clean demo state.
  React.useEffect(() => {
    if (session?.user.id) {
      void refreshOwnedPets();
      return;
    }
    setOwnedPets([]);
    setActivePetState(ME);
    setMode(ME.mode);
    setMatches([]);
    setChats([]);
    setPendingMatch(null);
    setMeetingMarkers({});
    setMeetingTraces({});
    setLikedPetIds(new Set());
    setPetSessions({});
    setProgressByPet({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const petProgress = progressByPet[activePet.id] ?? { matches: 0, outings: 0, messagesReceived: 0, sessions: 0 };

  const updateProgress = useCallback((petId: number, update: Partial<PetProgress>) => {
    setProgressByPet((current) => ({
      ...current,
      [petId]: { ...(current[petId] ?? { matches: 0, outings: 0, messagesReceived: 0, sessions: 0 }), ...update },
    }));
  }, []);

  React.useEffect(() => {
    loadTreatBalance(apiPetId(activePet)).then(({ balance }) => setTreats(balance));
    updateProgress(activePet.id, { sessions: (progressByPet[activePet.id]?.sessions ?? 0) + 1 });
    if (session?.user.id) {
      // Counts this week's connection for the pet's streak and recomputes its XP.
      if (activePet.dbId) void refreshPetProgress(activePet.dbId);
      loadMeetingTraces(session.user.id, activePet.id).then(({ data }) => {
        setMeetingTraces((current) => ({
          ...current,
          ...Object.fromEntries(data.map((trace) => [Number(trace.matched_pet_key), { latitude: trace.latitude, longitude: trace.longitude, marker: trace.marker, status: trace.status, requestedBy: trace.requested_by }])) as Record<number, MeetingTrace>,
        }));
      });
      (async () => {
        try {
          const myId = apiPetId(activePet);
          const matchesData = await getMatches(myId);
          const otherIds = matchesData.map((m) => (m.pet1Id === myId ? m.pet2Id : m.pet1Id));
          // Other pets' UUIDs → the same numeric ids petRecordToPet gives them
          setLikedPetIds(new Set(otherIds.map(stablePetId)));
          // Matches and chats saved in the database (they survive app restarts).
          if (activePet.dbId) await loadDbConversations(activePet.dbId);
        } catch (error) {
          console.error("Error loading matches:", error);
        }
      })();
    }
  }, [activePet.id, session?.user.id, updateProgress]);

  const refreshTreats = useCallback(() => {
    void loadTreatBalance(apiPetId(activePet)).then(({ balance }) => setTreats(balance));
    if (activePet.dbId) void refreshPetProgress(activePet.dbId, false);
  }, [activePet]);

  const collectTreats = useCallback(async (amount: number, reason: "match" | "outing", contextKey: string) => {
    if (claimedTreatKeys.has(contextKey)) return;
    setClaimedTreatKeys((current) => new Set(current).add(contextKey));
    const result = await awardTreats(apiPetId(activePet), amount, reason, contextKey);
    if (result.awarded) setTreats((current) => result.balance ?? current + amount);
    // A match or outing can push the pet to a new level.
    if (activePet.dbId) void refreshPetProgress(activePet.dbId, false);
  }, [activePet, claimedTreatKeys]);

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
    setMatchIds({});
    setPendingMatch(null);
  }, [activePet.id, chats, matches, meetingMarkers, meetingTraces, petSessions]);

  const updateMode = useCallback((nextMode: number) => {
    setMode(nextMode);
    setActivePetState((current) => ({ ...current, mode: nextMode }));
  }, []);

  const likePet = useCallback(async (pet: Pet, superLike = false) => {
    setLikedPetIds((current) => new Set(current).add(pet.id));
    if (pet.dbId) recentlyLikedRef.current.add(pet.dbId);

    // The like carries the mood it's sent in (the Discover slider): the other pet sees it
    // blurred as a Hot or Friend like. Demo pets match from a fixed list; database pets
    // match only when the other pet likes back (or instantly for test bots).
    const intent = mode >= 50 ? "HOT" : "FRIEND";
    let dbType: MatchType | null = null;
    let isMatch = LIKED_BACK.has(pet.id);
    try {
      await createSwipe(apiPetId(activePet), apiPetId(pet), superLike ? "SUPER_LIKE" : "LIKE", intent);
      if (activePet.dbId && pet.dbId) {
        dbType = await getMatchType(activePet.dbId, pet.dbId);
        isMatch = dbType !== null;
      }
    } catch (error) {
      console.error("Error saving swipe:", error);
    }
    if (!isMatch) return;

    const matchType = dbType ? matchLabel(dbType, activePet, pet) : mode >= 50 && pet.mode >= 50 ? "Hot" : "Friend";
    const isHotMatch = matchType === "Hot";
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
              lastAt: now(),
            },
          ]
    );
    setPendingMatch({ ...pet, matchType } as any);
    updateProgress(activePet.id, { matches: petProgress.matches + 1 });
    // Treats are rare: 1 per match (the database caps it too, migration 018).
    void collectTreats(1, "match", `match:${activePet.id}:${pet.id}`);

    // Database matches are created server side: load the conversation (e.g. the bot's hello).
    if (pet.dbId) {
      if (activePet.dbId) void loadDbConversations(activePet.dbId);
      return;
    }
    try {
      await createMatch(apiPetId(activePet), apiPetId(pet), 0, isHotMatch ? "LOVE" : "FRIEND");
    } catch (error) {
      console.error("Error creating match:", error);
    }
  }, [activePet, collectTreats, mode, petProgress.matches, updateProgress]);

  const clearPendingMatch = useCallback(() => setPendingMatch(null), []);

  const sendMessage = useCallback((petId: number, text: string) => {
    if (!text.trim()) return;
    setChats((prev) =>
      prev.map((c) => (c.pet.id === petId ? { ...c, messages: [...c.messages, { from: "me", text }], lastAt: now() } : c))
    );
    persistMessage(petId, text);
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
  }, [activePet.id, persistMessage, petProgress.messagesReceived, updateProgress]);

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
    persistMessage(petId, messageText);
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
  }, [matches, persistMessage]);

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
    // Demo outings only; real ones earn their 2 treats once accepted (migration 018).
    void collectTreats(2, "outing", `outing:${activePet.id}:${petId}`);

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
    () => ({ activePet, setActivePet, ownedPets, refreshOwnedPets, mode, setMode: updateMode, matches, chats, pendingMatch, clearPendingMatch, likePet, sendMessage, markChatRead, refreshConversations, meetingMarkers, setMeetingMarker, meetingTraces, setMeetingTrace, confirmMeetingTrace, deleteMeetingTrace, treats, refreshTreats, petProgress, progressByPet }),
    [activePet, setActivePet, ownedPets, refreshOwnedPets, mode, updateMode, matches, chats, pendingMatch, clearPendingMatch, likePet, sendMessage, markChatRead, refreshConversations, meetingMarkers, setMeetingMarker, meetingTraces, setMeetingTrace, confirmMeetingTrace, deleteMeetingTrace, treats, refreshTreats, petProgress, progressByPet]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
