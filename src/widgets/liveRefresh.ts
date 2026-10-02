import { supabase } from "@/lib/supabase";
import { pick } from "@/i18n/useTranslation";
import { levelFromXp } from "@/utils/petProgression";
import { getNextOuting } from "@/data/api/meetings";
import type { Language } from "@/i18n/translations";
import { dayMessage, WidgetSnapshot } from "@/widgets/snapshot";

// The widgets refresh every 30 minutes, app closed or not. The snapshot saved by the app would
// grow old: this reads the latest numbers of the pet from the database (with the session kept
// on the phone) and updates it. Whatever fails keeps the saved value.

const MESSAGE_TYPES = ["message", "meeting", "relation", "adoption"];
const TIMEOUT_MS = 8000;

const withTimeout = <T,>(promise: Promise<T>) => Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))]);

export async function refreshSnapshot(snapshot: WidgetSnapshot): Promise<WidgetSnapshot> {
  const petId = snapshot.petDbId;
  if (!supabase || !petId) return snapshot;
  const client = supabase;
  const { data: session } = await client.auth.getSession();
  if (!session.session) return snapshot;
  const language: Language = snapshot.language === "en" ? "en" : "fr";
  const tx = (fr: string, en: string) => pick(language, fr, en);
  const format = (value: number) => Math.round(value).toLocaleString(language === "en" ? "en-GB" : "fr-FR");

  const result = await withTimeout(Promise.all([
    // "*": the health columns (birthday) belong to GRRRR Care and may not exist.
    client.from("pets").select("*").eq("id", petId).maybeSingle(),
    client.rpc("get_pet_likers", { p_pet_id: petId }),
    client.from("notifications").select("id", { count: "exact", head: true }).eq("pet_id", petId).is("read_at", null).in("type", MESSAGE_TYPES),
    getNextOuting(petId).catch(() => null),
  ]));
  if (!result) return snapshot;
  const [{ data: pet }, likers, unreadResult, nextOuting] = result;
  const next: WidgetSnapshot = { ...snapshot, updatedAt: new Date().toISOString(), pet: { ...snapshot.pet }, social: { ...snapshot.social } };

  if (pet) {
    const level = levelFromXp(pet.xp ?? 0);
    next.pet.rankLevel = level.level;
    next.pet.rank = tx(level.rank.name, level.rank.nameEn);
    next.pet.rankColor = level.rank.color;
    next.pet.progress = level.progress;
    next.pet.xp = level.next === null ? `${format(pet.xp ?? 0)} XP · max` : `${format(pet.xp ?? 0)} / ${format(level.next)} XP`;
    next.pet.treats = `🦴 ${format(pet.treats ?? 0)} ${tx("croquettes", "treats")}`;
    if (pet.photo_url) next.pet.photo = pet.photo_url;
  }
  if (!likers.error && Array.isArray(likers.data)) next.social.likes = likers.data.length;
  if (!unreadResult.error && typeof unreadResult.count === "number") {
    next.social.unread = unreadResult.count;
    next.social.unreadLabel = tx(unreadResult.count > 1 ? "messages" : "message", unreadResult.count > 1 ? "messages" : "message");
  }
  const { likes, unread } = next.social;
  next.social.headline =
    unread > 0 ? tx(`💬 ${unread} message${unread > 1 ? "s" : ""} à lire`, `💬 ${unread} message${unread > 1 ? "s" : ""} to read`)
    : likes > 0 ? tx(`💌 ${likes} like${likes > 1 ? "s" : ""} à découvrir`, `💌 ${likes} like${likes > 1 ? "s" : ""} to discover`)
    : tx("Swipe dans Discover pour de nouvelles rencontres 🐾", "Swipe in Discover to meet new friends 🐾");

  if (pet) {
    next.day = dayMessage({
      language,
      pet: { id: 0, name: pet.pet_name ?? snapshot.pet.name, species: pet.species ?? "dog", health: { birthday: pet.birthday ?? null } } as never,
      care: null,
      nextOuting,
      now: new Date(),
    });
    // The health tip needs Care: keep the app's one rather than replace it by a fact.
    if (snapshot.day.icon === "🩺" && next.day.icon === "🧠") next.day = snapshot.day;
  }
  return next;
}
