import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useAppState } from "@/context/AppState";
import { useLocalization } from "@/context/LocalizationContext";
import { navigationRef } from "@/navigation/navigationRef";
import NotificationBanner from "@/components/NotificationBanner";
import { careUrlForPet, getCareStatus } from "@/data/api/care";
import { stablePetId } from "@/data/api/profile";
import { describeNotification } from "@/utils/notificationText";
import { supabase } from "@/lib/supabase";
import { dismissPushesFrom, getPushToken, onPushOpened, PushResponse, registerPushToken, setAppBadge, unregisterPushToken } from "@/lib/push";
import { sendMatchMessage } from "@/data/api/chat";
import { answerMeeting, getLatestMeeting } from "@/data/api/meetings";
import { getLitter, respondToLitter } from "@/data/api/adoption";
import {
  AppNotification,
  CATEGORY_OF,
  deletePetNotifications,
  getAnnouncements,
  getPetNotifications,
  markNotificationsRead,
  NotificationActor,
  NotificationCategory,
  NotificationType,
  subscribeToAnnouncements,
  subscribeToNotifications,
} from "@/data/api/notifications";

export type NotificationPrefs = Record<NotificationCategory, boolean> & {
  /** Also show a browser notification when the app is in a background tab (web) */
  system: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = { messages: true, social: true, care: true, news: true, system: false };
const PREFS_KEY = "grrrr.notifications.prefs";
const localKey = (userKey: string) => `grrrr.notifications.local.${userKey}`;
const MAX_LOCAL = 120;
// Matches and level-ups already have their own full-screen celebration.
const NO_BANNER: NotificationType[] = ["match", "level_up"];

type LocalInput = { id: string; type: NotificationType; data?: Record<string, any>; actor?: NotificationActor; createdAt?: string };

interface NotificationsShape {
  /** Newest first, without the categories switched off */
  notifications: AppNotification[];
  unreadCount: number;
  prefs: NotificationPrefs;
  setPref: (key: keyof NotificationPrefs, value: boolean) => void;
  /** The pet shown on a notification: where it comes from, or my own pet for news and reminders */
  actorOf: (notification: AppNotification) => NotificationActor;
  open: (notification: AppNotification) => void;
  markAllRead: () => void;
  /** Called when a chat is opened: its message notifications are read */
  markReadFrom: (actorDbId?: string) => void;
  clearAll: () => void;
  sendTest: () => void;
}

const NotificationsContext = createContext<NotificationsShape | undefined>(undefined);

const browserNotification = (): any => (Platform.OS === "web" ? (globalThis as any).Notification : undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { activePet, chats, refreshConversations } = useAppState();
  const { language } = useLocalization();
  const userKey = session?.user.id ?? "guest";
  const [remote, setRemote] = useState<AppNotification[]>([]);
  const [local, setLocal] = useState<AppNotification[]>([]);
  const [localReady, setLocalReady] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const localRef = useRef(local);
  localRef.current = local;

  const myActor = useMemo<NotificationActor>(
    () => ({ dbId: activePet.dbId ?? "", name: activePet.name, species: activePet.species, photo: activePet.photo }),
    [activePet.dbId, activePet.name, activePet.photo, activePet.species]
  );
  // Someone waiting without a pet of their own stays anonymous: no photo (migration 024).
  const actorOf = useCallback(
    (notification: AppNotification) => (notification.data?.anonymous && notification.actor ? { ...notification.actor, photo: "" } : notification.actor ?? myActor),
    [myActor]
  );

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((stored) => stored && setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) })).catch(() => {});
  }, []);

  // Notifications kept on this device (news, reminders), per account.
  useEffect(() => {
    let active = true;
    setLocalReady(false);
    AsyncStorage.getItem(localKey(userKey))
      .then((stored) => active && setLocal(stored ? JSON.parse(stored) : []))
      .catch(() => active && setLocal([]))
      .finally(() => active && setLocalReady(true));
    return () => {
      active = false;
    };
  }, [userKey]);

  const saveLocal = useCallback((update: (current: AppNotification[]) => AppNotification[]) => {
    setLocal((current) => {
      const next = update(current).slice(0, MAX_LOCAL);
      void AsyncStorage.setItem(localKey(userKey), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [userKey]);

  // Shows the banner (and a browser notification when the tab is in the background).
  const present = useCallback((notification: AppNotification) => {
    const currentPrefs = prefsRef.current;
    if (!currentPrefs[CATEGORY_OF[notification.type]] || NO_BANNER.includes(notification.type)) return;
    setBanner(notification);
    const Browser = browserNotification();
    if (currentPrefs.system && Browser?.permission === "granted" && (globalThis as any).document?.hidden) {
      const text = describeNotification(notification, language, activePet.name);
      try {
        new Browser(`${text.icon} ${text.title}`, { body: text.body, icon: (notification.actor ?? myActor).photo || undefined });
      } catch {
        // Some browsers only allow notifications from a service worker.
      }
    }
  }, [activePet.name, language, myActor]);

  /** Adds a notification kept on this device, once per id. */
  const pushLocal = useCallback((input: LocalInput, showBanner = true) => {
    if (localRef.current.some((item) => item.id === input.id)) return;
    const notification: AppNotification = { id: input.id, type: input.type, createdAt: input.createdAt ?? new Date().toISOString(), read: false, actor: input.actor, data: input.data ?? {}, remote: false };
    localRef.current = [notification, ...localRef.current];
    saveLocal((current) => (current.some((item) => item.id === notification.id) ? current : [notification, ...current]));
    if (showBanner) present(notification);
  }, [present, saveLocal]);

  // Events of my pet (likes, matches, messages...), live.
  useEffect(() => {
    const petId = activePet.dbId;
    setRemote([]);
    if (!session?.user.id || !petId) return;
    let active = true;
    getPetNotifications(petId).then((items) => active && setRemote(items));
    const unsubscribe = subscribeToNotifications(petId, (notification) => {
      if (!active) return;
      // Already reading this conversation: no need to announce its messages.
      const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
      const inThatChat = CATEGORY_OF[notification.type] === "messages" && route?.name === "ChatThread" && notification.actor && (route.params as { petId?: number } | undefined)?.petId === stablePetId(notification.actor.dbId);
      if (inThatChat) {
        void markNotificationsRead([notification.id]);
        setRemote((current) => [{ ...notification, read: true }, ...current]);
        return;
      }
      setRemote((current) => (current.some((item) => item.id === notification.id) ? current : [notification, ...current]));
      present(notification);
    });
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePet.dbId, session?.user.id]);

  // News for everyone: the ones already published arrive silently, new ones with a banner.
  useEffect(() => {
    if (!localReady) return;
    let active = true;
    getAnnouncements().then((items) => active && items.forEach((item) => pushLocal(item, false)));
    const unsubscribe = subscribeToAnnouncements((item) => active && pushLocal(item));
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReady, userKey]);

  // Reminders created on the device for the active pet: welcome, birthday, health.
  useEffect(() => {
    const petId = activePet.dbId;
    if (!localReady || !session?.user.id || !petId) return;
    let active = true;
    pushLocal({ id: `welcome:${userKey}`, type: "welcome" }, false);
    const today = new Date();
    const birthday = activePet.health?.birthday;
    if (birthday && birthday.slice(5) === today.toISOString().slice(5, 10)) pushLocal({ id: `birthday:${petId}:${today.getFullYear()}`, type: "birthday" });
    // One health reminder a week at most, with Care's most useful next step.
    const week = Math.floor(today.getTime() / (7 * 864e5));
    getCareStatus(petId).then((status) => {
      if (!active || !status) return;
      const url = careUrlForPet(petId);
      if (status.status === "ok" && status.advice && status.level !== "good") {
        pushLocal({ id: `care:${petId}:${week}`, type: "care", data: { titleFr: `Santé de ${activePet.name}`, titleEn: `${activePet.name}'s health`, bodyFr: status.advice.fr, bodyEn: status.advice.en, url } });
      } else if (status.status === "no_data") {
        pushLocal({ id: `care-start:${petId}`, type: "care", data: { titleFr: `Le carnet de santé de ${activePet.name}`, titleEn: `${activePet.name}'s health record`, bodyFr: "Ajoute ses vaccins et visites dans GRRRR Care pour suivre sa santé.", bodyEn: "Add vaccines and vet visits in GRRRR Care to track their health.", url } });
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePet.dbId, localReady, session?.user.id]);

  const notifications = useMemo(
    () => [...remote, ...local].filter((item) => !item.hidden && CATEGORY_OF[item.type] && prefs[CATEGORY_OF[item.type]]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [local, prefs, remote]
  );
  const unreadCount = notifications.filter((item) => !item.read).length;

  // The number on the app icon follows what is still unread.
  useEffect(() => {
    if (session?.user.id) setAppBadge(unreadCount);
  }, [session?.user.id, unreadCount]);

  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    setRemote((current) => current.map((item) => (set.has(item.id) ? { ...item, read: true } : item)));
    if (localRef.current.some((item) => set.has(item.id) && !item.read)) saveLocal((current) => current.map((item) => (set.has(item.id) ? { ...item, read: true } : item)));
    void markNotificationsRead(ids);
  }, [saveLocal]);

  const markAllRead = useCallback(() => markRead(notifications.filter((item) => !item.read).map((item) => item.id)), [markRead, notifications]);

  const markReadFrom = useCallback((actorDbId?: string) => {
    if (!actorDbId) return;
    markRead([...remote, ...local].filter((item) => !item.read && CATEGORY_OF[item.type] === "messages" && item.actor?.dbId === actorDbId).map((item) => item.id));
    // Its pushes leave the phone's notification tray too.
    void dismissPushesFrom(actorDbId);
    setBanner((current) => (current && CATEGORY_OF[current.type] === "messages" && current.actor?.dbId === actorDbId ? null : current));
  }, [local, markRead, remote]);

  const clearAll = useCallback(() => {
    setRemote([]);
    // Kept but hidden, so news already seen are not added again at the next launch.
    saveLocal((current) => current.filter((item) => !item.id.startsWith("test:")).map((item) => ({ ...item, read: true, hidden: true })));
    void deletePetNotifications(activePet.dbId);
  }, [activePet.dbId, saveLocal]);

  const open = useCallback((notification: AppNotification) => {
    markRead([notification.id]);
    setBanner(null);
    if (!navigationRef.isReady()) return;
    const tab = (screen: string) => navigationRef.navigate("MainTabs", { screen });
    switch (notification.type) {
      case "message":
      case "meeting":
      case "relation":
      case "adoption":
      case "adoption_listed": {
        const chat = chats.find((item) => item.pet.dbId && item.pet.dbId === notification.actor?.dbId);
        if (chat) navigationRef.navigate("ChatThread", { petId: chat.pet.id });
        else tab("Chat");
        return;
      }
      case "like":
      case "super_like":
        return tab("Discover");
      case "match":
      case "adoption_interest":
        return tab("Matches");
      case "thread":
        return tab("Explore");
      // Reminders say where they lead (migration 020).
      case "reminder": {
        const screen = notification.data.screen;
        if (screen === "chat") {
          const chat = chats.find((item) => item.pet.dbId && item.pet.dbId === notification.actor?.dbId);
          if (chat) navigationRef.navigate("ChatThread", { petId: chat.pet.id });
          else tab("Chat");
          return;
        }
        return tab(screen === "matches" ? "Matches" : screen === "explore" ? "Explore" : screen === "discover" ? "Discover" : "MyPet");
      }
      case "store":
      case "care":
      case "news":
        if (notification.data.url) void Linking.openURL(notification.data.url);
        else tab("Explore");
        return;
      default:
        return tab("MyPet");
    }
  }, [chats, markRead]);

  const setPref = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    const apply = (granted: boolean) => setPrefs((current) => {
      const next = { ...current, [key]: granted };
      void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    const Browser = browserNotification();
    // The browser asks the user before allowing its own notifications.
    if (key === "system" && value && Browser && Browser.permission !== "granted") {
      Promise.resolve(Browser.requestPermission()).then((permission) => apply(permission === "granted")).catch(() => apply(false));
      return;
    }
    apply(key === "system" && !Browser ? false : value);
  }, []);

  // Phones: register for push (sent by the send-push Edge Function when the app is closed).
  const [pushToken, setPushToken] = useState<string | null>(null);
  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    let token: string | null = null;
    getPushToken(language).then((value) => {
      token = value;
      if (active) setPushToken(value);
    });
    return () => {
      active = false;
      setPushToken(null);
      // Signed out: this phone stops receiving the account's notifications.
      if (token && supabase) void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) void unregisterPushToken(token!);
      });
    };
  }, [session?.user.id]);

  // The server skips the categories switched off here, and writes in the app's language.
  useEffect(() => {
    if (pushToken) void registerPushToken(pushToken, language, { messages: prefs.messages, social: prefs.social, care: prefs.care, news: prefs.news });
  }, [language, prefs.care, prefs.messages, prefs.news, prefs.social, pushToken]);

  // A tapped push notification opens the same screen as the in-app one. Its buttons act first:
  // reply to a message, accept or decline an outing or a relationship (as the pet it was sent to).
  const openRef = useRef(open);
  openRef.current = open;
  const refreshRef = useRef(refreshConversations);
  refreshRef.current = refreshConversations;
  useEffect(() => onPushOpened(async ({ data, action, text }: PushResponse) => {
    if (!data.type || !CATEGORY_OF[data.type as NotificationType]) return;
    const petId: string | undefined = data.petId;
    const otherId: string | undefined = data.actorPetId ?? undefined;
    try {
      if (action === "reply" && text && data.matchId && petId) {
        await sendMatchMessage(data.matchId, petId, text);
      } else if ((action === "accept" || action === "decline") && petId && otherId) {
        if (data.type === "meeting") {
          const meeting = await getLatestMeeting(petId, otherId);
          if (meeting?.status === "pending" && meeting.proposerPetId !== petId) await answerMeeting(meeting.id, action === "accept");
        } else if (data.type === "relation") {
          const litter = await getLitter(petId, otherId);
          if (litter?.status === "pending" && litter.proposerPetId !== petId) await respondToLitter(litter.id, action === "accept");
        }
      }
      if (action !== "open") void refreshRef.current();
    } catch (error) {
      console.warn("Notification action failed", error);
    }
    openRef.current({ id: String(data.id ?? ""), type: data.type, createdAt: new Date().toISOString(), read: false, data, remote: true, actor: otherId ? { dbId: otherId, name: "", species: "", photo: "" } : undefined });
  }), []);

  const sendTest = useCallback(() => {
    pushLocal({ id: `test:${Date.now()}`, type: "message", actor: myActor, data: { preview: language === "en" ? "This is what my notifications look like 🐾" : "Voilà à quoi ressemblent mes notifications 🐾" } });
  }, [language, myActor, pushLocal]);

  const value = useMemo(
    () => ({ notifications, unreadCount, prefs, setPref, actorOf, open, markAllRead, markReadFrom, clearAll, sendTest }),
    [actorOf, clearAll, markAllRead, markReadFrom, notifications, open, prefs, sendTest, setPref, unreadCount]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationBanner notification={banner} actor={banner ? actorOf(banner) : undefined} myPetName={activePet.name} onPress={() => banner && open(banner)} onClose={() => setBanner(null)} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
