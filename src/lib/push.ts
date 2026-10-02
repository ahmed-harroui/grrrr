import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

// Push notifications on iOS and Android: the phone registers its Expo push token in
// push_tokens (migration 011) and the send-push Edge Function sends to it.

// Expo Go has no remote push since SDK 53 (it only warns): push only in the real app (EAS builds).
const isExpoGo = Constants.executionEnvironment === "storeClient";
const isNative = (Platform.OS === "ios" || Platform.OS === "android") && !isExpoGo;

// App open: the in-app banner shows the notification, the system one stays quiet.
if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

type Language = "fr" | "en";
const pick = (language: Language, fr: string, en: string) => (language === "en" ? en : fr);

// Android channels, one per kind of notification: each can be silenced in the phone's settings.
// send-push picks the channel by type (keep the ids in sync with supabase/functions/send-push).
async function setUpChannels(language: Language) {
  if (Platform.OS !== "android") return;
  const channel = (id: string, fr: string, en: string, importance: Notifications.AndroidImportance, descriptionFr: string, descriptionEn: string) =>
    Notifications.setNotificationChannelAsync(id, { name: pick(language, fr, en), description: pick(language, descriptionFr, descriptionEn), importance, lightColor: "#FF5D73", vibrationPattern: [0, 180, 120, 180], showBadge: true });
  await Promise.all([
    channel("messages", "Messages", "Messages", Notifications.AndroidImportance.HIGH, "Les messages de tes matchs", "Messages from your matches"),
    channel("outings", "Sorties", "Outings", Notifications.AndroidImportance.HIGH, "Propositions de sortie et réponses", "Outing proposals and answers"),
    channel("adoption", "Relations et adoption", "Relationships and adoption", Notifications.AndroidImportance.HIGH, "Relations, bébés à adopter, demandes", "Relationships, babies to adopt, requests"),
    channel("social", "Likes et matchs", "Likes and matches", Notifications.AndroidImportance.DEFAULT, "Likes reçus, matchs, niveaux", "Likes received, matches, levels"),
    channel("news", "Nouveautés", "News", Notifications.AndroidImportance.LOW, "Boutique, threads, conseils santé", "Shop, threads, health tips"),
  ]);
  // The single channel of earlier versions.
  await Notifications.deleteNotificationChannelAsync("default").catch(() => {});
}

// Buttons shown on the notification itself (send-push sets the category).
async function setUpActions(language: Language) {
  const opens = { opensAppToForeground: true };
  await Promise.all([
    Notifications.setNotificationCategoryAsync("message", [
      { identifier: "reply", buttonTitle: pick(language, "Répondre", "Reply"), textInput: { submitButtonTitle: pick(language, "Envoyer", "Send"), placeholder: pick(language, "Ton message…", "Your message…") }, options: opens },
    ]),
    Notifications.setNotificationCategoryAsync("meeting_proposal", [
      { identifier: "accept", buttonTitle: pick(language, "✅ Accepter", "✅ Accept"), options: opens },
      { identifier: "decline", buttonTitle: pick(language, "Refuser", "Decline"), options: { ...opens, isDestructive: true } },
    ]),
    Notifications.setNotificationCategoryAsync("relation_proposal", [
      { identifier: "accept", buttonTitle: pick(language, "💞 Accepter", "💞 Accept"), options: opens },
      { identifier: "decline", buttonTitle: pick(language, "Refuser", "Decline"), options: { ...opens, isDestructive: true } },
    ]),
  ]).catch((error) => console.warn("Notification buttons not set", error));
}

/** Asks the permission and returns this phone's Expo push token (null on web, simulators, or when refused). */
export async function getPushToken(language: Language = "fr"): Promise<string | null> {
  if (!isNative || !Device.isDevice) return null;
  try {
    await setUpChannels(language);
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch (error) {
    console.warn("Push token not available", error);
    return null;
  }
}

/** Saves the token for the signed-in account, with the categories switched off in the app; the channels and buttons follow the language. */
export async function registerPushToken(token: string, language: string, prefs: Record<string, boolean>) {
  const lang: Language = language === "en" ? "en" : "fr";
  void setUpChannels(lang).catch(() => {});
  void setUpActions(lang);
  if (!supabase) return;
  const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS, p_language: language, p_prefs: prefs });
  if (error) console.warn("Push token not saved", error.message);
}

/** At sign-out: this phone stops receiving the account's notifications. */
export async function unregisterPushToken(token: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("unregister_push_token", { p_token: token });
  if (error) console.warn("Push token not removed", error.message);
}

/** What the user did with a push: tapped it ("open") or one of its buttons, with the typed reply. */
export type PushResponse = { data: Record<string, any>; action: "open" | "reply" | "accept" | "decline"; text?: string };

/** Calls onResponse for a push notification the user tapped or answered (also the one that launched the app). */
export function onPushOpened(onResponse: (response: PushResponse) => void) {
  if (!isNative) return () => {};
  let active = true;
  const handle = (response: Notifications.NotificationResponse) => {
    const id = response.actionIdentifier;
    const action = id === "reply" || id === "accept" || id === "decline" ? id : "open";
    onResponse({ data: response.notification.request.content.data ?? {}, action, text: response.userText?.trim() || undefined });
    // Answered: it leaves the notification tray.
    void Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
  };
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!active || !response) return;
      handle(response);
      void Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
    })
    .catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => {
    active = false;
    subscription.remove();
  };
}

/** Removes from the tray the notifications coming from this pet (its chat was just opened). */
export async function dismissPushesFrom(actorPetId?: string) {
  if (!isNative || !actorPetId) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(presented.filter((item) => item.request.content.data?.actorPetId === actorPetId).map((item) => Notifications.dismissNotificationAsync(item.request.identifier)));
  } catch {
    // Not available on this phone: nothing to tidy.
  }
}

/** The number on the app icon (launchers that support it). */
export function setAppBadge(count: number) {
  if (!isNative) return;
  void Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => {});
}
