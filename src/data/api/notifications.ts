import { supabase } from "@/lib/supabase";

// Events of one pet come from the notifications table (written by database triggers,
// migration 011). News for everyone come from announcements. Care reminders and tips are
// created on the device.

export type NotificationType =
  | "message" | "meeting" | "relation" | "adoption"
  | "like" | "super_like" | "match" | "level_up" | "adoption_listed" | "adoption_interest" | "reminder"
  | "thread" | "store" | "news"
  | "care" | "birthday"
  | "welcome";

/** What the user can switch on or off. */
export type NotificationCategory = "messages" | "social" | "care" | "news";

export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  message: "messages",
  meeting: "messages",
  relation: "messages",
  adoption: "messages",
  like: "social",
  super_like: "social",
  match: "social",
  level_up: "social",
  adoption_listed: "social",
  // Someone swiped my pet up: they wait for its babies (migration 021)
  adoption_interest: "social",
  // Sent on their own (migration 020): daily nudge, outing soon
  reminder: "social",
  thread: "news",
  store: "news",
  news: "news",
  care: "care",
  birthday: "care",
  welcome: "news",
};

/** The pet a notification comes from; its avatar is shown on it. */
export type NotificationActor = { dbId: string; name: string; species: string; photo: string };

export interface AppNotification {
  id: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  /** Missing for news and reminders: they show my own pet */
  actor?: NotificationActor;
  data: Record<string, any>;
  /** Saved in the notifications table (false: kept on this device) */
  remote: boolean;
  /** Cleared by the user; kept on the device so it is not added again */
  hidden?: boolean;
}

const isUuid = (id?: string) => Boolean(id && /^[0-9a-f-]{36}$/i.test(id));
const ACTOR_FIELDS = "id, pet_name, species, photo_url";
const KNOWN_TYPES = new Set(Object.keys(CATEGORY_OF));

function toActor(row?: Record<string, any> | null): NotificationActor | undefined {
  if (!row?.id) return undefined;
  return { dbId: row.id, name: row.pet_name ?? "", species: row.species ?? "dog", photo: row.photo_url ?? "" };
}

function toNotification(row: Record<string, any>, actor?: NotificationActor): AppNotification | null {
  if (!KNOWN_TYPES.has(row.type)) return null;
  return { id: row.id, type: row.type, createdAt: row.created_at, read: Boolean(row.read_at), actor, data: row.data ?? {}, remote: true };
}

export async function getNotificationActor(petId?: string | null) {
  if (!supabase || !isUuid(petId ?? undefined)) return undefined;
  const { data } = await supabase.from("pets").select(ACTOR_FIELDS).eq("id", petId).maybeSingle();
  return toActor(data);
}

/** Latest notifications of my pet, newest first. */
export async function getPetNotifications(petId?: string, limit = 60): Promise<AppNotification[]> {
  if (!supabase || !isUuid(petId)) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select(`id, type, data, read_at, created_at, actor:pets!notifications_actor_pet_id_fkey(${ACTOR_FIELDS})`)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("Notifications could not be loaded", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, any>[])
    .map((row) => toNotification(row, toActor(Array.isArray(row.actor) ? row.actor[0] : row.actor)))
    .filter((item): item is AppNotification => item !== null);
}

export async function markNotificationsRead(ids: string[]) {
  const remoteIds = ids.filter(isUuid);
  if (!supabase || remoteIds.length === 0) return;
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", remoteIds);
  if (error) console.warn("Notifications not marked as read", error.message);
}

export async function deletePetNotifications(petId?: string) {
  if (!supabase || !isUuid(petId)) return;
  const { error } = await supabase.from("notifications").delete().eq("pet_id", petId);
  if (error) console.warn("Notifications not deleted", error.message);
}

/** Calls onNotification for every new notification of my pet (needs notifications in realtime). */
export function subscribeToNotifications(petId: string, onNotification: (notification: AppNotification) => void) {
  if (!supabase || !isUuid(petId)) return () => {};
  const client = supabase;
  const channel = client
    .channel(`notifications-${petId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `pet_id=eq.${petId}` }, async (payload) => {
      const row = payload.new as Record<string, any>;
      const notification = toNotification(row, await getNotificationActor(row.actor_pet_id));
      if (notification) onNotification(notification);
    })
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

function announcementToNotification(row: Record<string, any>): AppNotification | null {
  if (!KNOWN_TYPES.has(row.type)) return null;
  return {
    id: `announcement:${row.id}`,
    type: row.type,
    createdAt: row.created_at,
    read: false,
    data: { titleFr: row.title_fr, titleEn: row.title_en, bodyFr: row.body_fr, bodyEn: row.body_en, url: row.url ?? undefined },
    remote: false,
  };
}

/** News for everyone (shop, threads, care tips), newest first. */
export async function getAnnouncements(limit = 20): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.warn("Announcements could not be loaded", error.message);
    return [];
  }
  return (data ?? []).map(announcementToNotification).filter((item): item is AppNotification => item !== null);
}

export function subscribeToAnnouncements(onAnnouncement: (notification: AppNotification) => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`announcements-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (payload) => {
      const notification = announcementToNotification(payload.new as Record<string, any>);
      if (notification) onAnnouncement(notification);
    })
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
