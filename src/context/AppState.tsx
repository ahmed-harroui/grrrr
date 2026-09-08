import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ME, Pet, WILL_MATCH } from "@/data/mockPets";

export interface ChatMessage {
  from: "me" | "them";
  text: string;
}

export interface Chat {
  pet: Pet;
  messages: ChatMessage[];
}

interface AppStateShape {
  mode: number; // 0..100, 0 = FRIEND, 100 = HOT/LOVE
  setMode: (v: number) => void;
  matches: Pet[];
  chats: Chat[];
  pendingMatch: Pet | null;
  clearPendingMatch: () => void;
  likePet: (pet: Pet) => void;
  sendMessage: (petId: number, text: string) => void;
}

const AppStateContext = createContext<AppStateShape | undefined>(undefined);

const AUTO_REPLIES = [
  "Trop bien 🐾",
  "On se fait une balade ce week-end ?",
  "Haha j'adore !",
  `${ME.name} a l'air adorable 😍`,
];

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState(ME.mode);
  const [matches, setMatches] = useState<Pet[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [pendingMatch, setPendingMatch] = useState<Pet | null>(null);

  const likePet = useCallback((pet: Pet) => {
    if (!WILL_MATCH.has(pet.id)) return;
    setMatches((prev) => (prev.find((p) => p.id === pet.id) ? prev : [...prev, pet]));
    setChats((prev) =>
      prev.find((c) => c.pet.id === pet.id)
        ? prev
        : [
            ...prev,
            {
              pet,
              messages: [{ from: "them", text: `Salut ! ${ME.name} et ${pet.name} se sont plu 🐾` }],
            },
          ]
    );
    setPendingMatch(pet);
  }, []);

  const clearPendingMatch = useCallback(() => setPendingMatch(null), []);

  const sendMessage = useCallback((petId: number, text: string) => {
    if (!text.trim()) return;
    setChats((prev) =>
      prev.map((c) => (c.pet.id === petId ? { ...c, messages: [...c.messages, { from: "me", text }] } : c))
    );
    setTimeout(() => {
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      setChats((prev) =>
        prev.map((c) =>
          c.pet.id === petId ? { ...c, messages: [...c.messages, { from: "them", text: reply }] } : c
        )
      );
    }, 900);
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, matches, chats, pendingMatch, clearPendingMatch, likePet, sendMessage }),
    [mode, matches, chats, pendingMatch, clearPendingMatch, likePet, sendMessage]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
