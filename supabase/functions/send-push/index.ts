// Sends a push notification to the owner's phones for every new row in
// public.notifications, and to every phone for every new row in public.announcements: the GRRRR
// app's phones. Rows of public.care_notifications go to the GRRR Care app's phones (push_tokens.app,
// GRRR Care migration 016): the two apps share this database but never each other's notifications.
//
// Setup (once):
//   1. supabase secrets set PUSH_WEBHOOK_SECRET=<a long random text>
//   2. supabase functions deploy send-push --no-verify-jwt
//   3. Dashboard > Database > Webhooks: two webhooks, on INSERT of notifications and of
//      announcements, HTTP POST to this function, with the header
//      x-webhook-secret: <the same text>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Row = Record<string, any>;
type Token = { token: string; language: string; prefs: Record<string, boolean> | null };

const CATEGORY: Record<string, string> = {
  message: "messages", meeting: "messages", relation: "messages", adoption: "messages",
  like: "social", super_like: "social", match: "social", level_up: "social", adoption_listed: "social", adoption_interest: "social", reminder: "social",
  thread: "news", store: "news", news: "news", care: "care",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Same texts as the app (src/utils/notificationText.ts).
function describe(type: string, data: Row, actor: string, me: string, en: boolean): { title: string; body: string } | null {
  const tx = (fr: string, english: string) => (en ? english : fr);
  const hot = data.intent === "HOT" || data.match_type === "LOVE";
  const mood = hot ? "Hot ✦" : "Friend 🐾";
  switch (type) {
    case "message":
      return { title: `💬 ${actor}`, body: data.preview ?? tx("Nouveau message", "New message") };
    case "meeting":
      // A proposal, an answer or a cancellation: the message itself says which.
      return { title: tx(`📍 Sortie avec ${actor}`, `📍 Outing with ${actor}`), body: data.preview ?? tx("Ouvre le chat pour voir la sortie.", "Open the chat to see the outing.") };
    case "relation":
      return { title: tx(`💞 Relation avec ${actor}`, `💞 Relationship with ${actor}`), body: data.preview ?? tx("Ouvre le chat pour répondre.", "Open the chat to answer.") };
    case "adoption":
      return { title: tx("🍼 Demande d'adoption", "🍼 Adoption request"), body: data.preview ?? tx(`${actor} aimerait adopter un bébé de ${me}.`, `${actor} would like to adopt one of ${me}'s babies.`) };
    case "adoption_interest":
      return data.intent === "BUY"
        ? { title: tx(`💶 ${actor} aimerait acheter un bébé de ${me}`, `💶 ${actor} would like to buy one of ${me}'s babies`), body: tx("Sa demande partira dès que tu proposeras une portée. Retrouve-le dans Matchs.", "Their request leaves as soon as you offer a litter. Find them in Matches.") }
        : { title: tx(`🍼 ${actor} aimerait adopter un bébé de ${me}`, `🍼 ${actor} would like to adopt one of ${me}'s babies`), body: tx("Sa demande partira dès que tu proposeras une portée. Retrouve-le dans Matchs.", "Their request leaves as soon as you offer a litter. Find them in Matches.") };
    case "adoption_listed":
      return { title: tx(`🍼 ${actor} a des bébés à adopter !`, `🍼 ${actor} has babies to adopt!`), body: tx("Ta demande est partie chez les deux parents : réponds-leur dans Messages.", "Your request went to both parents: answer them in Messages.") };
    // Likes stay anonymous until the like back, as in the app: only how many are waiting.
    case "like":
    case "super_like": {
      const count = Math.max(1, Number(data.pending) || 1);
      const discover = count > 1
        ? tx("Découvre-les dans Discover et like en retour 👀", "Discover them in Discover and like back 👀")
        : tx("Découvre-le dans Discover et like en retour 👀", "Discover them in Discover and like back 👀");
      if (type === "super_like") {
        return {
          title: tx(`⭐ Super like pour ${me} !`, `⭐ Super like for ${me}!`),
          body: count > 1 ? tx(`${count} compagnons ont liké ${me}. ${discover}`, `${count} companions liked ${me}. ${discover}`) : discover,
        };
      }
      return {
        title: count > 1 ? tx(`💌 ${count} compagnons ont liké ${me}`, `💌 ${count} companions liked ${me}`) : tx(`💌 Un compagnon a liké ${me}`, `💌 A companion liked ${me}`),
        body: discover,
      };
    }
    case "match":
      return { title: tx(`${hot ? "❤️" : "🐾"} Match ${mood} avec ${actor} !`, `${hot ? "❤️" : "🐾"} ${mood} match with ${actor}!`), body: tx(`${me} et ${actor} se sont plu. Dis-lui bonjour !`, `${me} and ${actor} like each other. Say hello!`) };
    case "level_up":
      return { title: tx(`🏆 ${me} passe niveau ${data.level ?? ""}`, `🏆 ${me} reached level ${data.level ?? ""}`), body: tx("Un nouveau rang à découvrir sur son profil.", "A new rank to discover on their profile.") };
    // Reminders (migration 020) carry their texts in both languages.
    case "reminder":
      return { title: `${data.icon ? `${data.icon} ` : ""}${tx(data.titleFr ?? "GRRRR", data.titleEn ?? data.titleFr ?? "GRRRR")}`, body: tx(data.bodyFr ?? "", data.bodyEn ?? data.bodyFr ?? "") };
    default:
      return null;
  }
}

async function send(messages: Row[]) {
  // Expo accepts 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const response = await fetch(EXPO_PUSH_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(chunk) });
    const result = await response.json().catch(() => null);
    // Phones where the app was uninstalled are forgotten.
    const gone = (result?.data ?? []).map((ticket: Row, index: number) => (ticket?.details?.error === "DeviceNotRegistered" ? chunk[index].to : null)).filter(Boolean);
    if (gone.length) await supabase.from("push_tokens").delete().in("token", gone);
  }
}

const allowed = (token: Token, type: string) => token.prefs?.[CATEGORY[type]] !== false;

// Likes the pet has not answered yet: the blurred ones of the app (same rule as get_pet_likers).
async function pendingLikes(petId: string) {
  const { data: likes } = await supabase.from("pet_swipes").select("from_pet_id, action").eq("to_pet_id", petId);
  const likers = (likes ?? []).filter((swipe: Row) => ["LIKE", "SUPER_LIKE"].includes(String(swipe.action).toUpperCase())).map((swipe: Row) => swipe.from_pet_id);
  if (likers.length === 0) return 0;
  const [{ data: answered }, { data: matches }] = await Promise.all([
    supabase.from("pet_swipes").select("to_pet_id").eq("from_pet_id", petId).in("to_pet_id", likers),
    supabase.from("pet_matches").select("pet_one_id, pet_two_id").or(`pet_one_id.eq.${petId},pet_two_id.eq.${petId}`),
  ]);
  const done = new Set([
    ...(answered ?? []).map((swipe: Row) => swipe.to_pet_id),
    ...(matches ?? []).map((match: Row) => (match.pet_one_id === petId ? match.pet_two_id : match.pet_one_id)),
  ]);
  return new Set(likers.filter((id: string) => !done.has(id))).size;
}

// Android channel of each type (created by the app, src/lib/push.ts): each can be silenced apart.
const CHANNEL: Record<string, string> = {
  message: "messages",
  meeting: "outings",
  relation: "adoption", adoption: "adoption", adoption_listed: "adoption", adoption_interest: "adoption",
  like: "social", super_like: "social", match: "social", level_up: "social",
  thread: "news", store: "news", news: "news", care: "news",
  reminder: "social",
};

// Buttons on the notification (src/lib/push.ts): reply to a message, answer a proposal.
function categoryOf(type: string, data: Row) {
  const preview = String(data.preview ?? "");
  if (type === "message") return "message";
  if (type === "meeting" && preview.startsWith("📍 Sortie proposée")) return "meeting_proposal";
  if (type === "relation" && preview.startsWith("💞 Relation proposée")) return "relation_proposal";
  return undefined;
}

// What someone sent waits for an answer: delivered right away, even in battery saving.
const URGENT = new Set(["message", "meeting", "relation", "adoption", "adoption_listed", "match"]);

async function notificationMessages(row: Row) {
  const { data: pet } = await supabase.from("pets").select("owner_id, pet_name, photo_url").eq("id", row.pet_id).maybeSingle();
  if (!pet) return [];
  const isLike = row.type === "like" || row.type === "super_like";
  const [{ data: tokens }, { data: actor }, pending] = await Promise.all([
    supabase.from("push_tokens").select("token, language, prefs").eq("user_id", pet.owner_id).eq("app", "grrrr"),
    // Who liked is not revealed: neither the name nor the photo.
    row.actor_pet_id && !isLike ? supabase.from("pets").select("pet_name, photo_url").eq("id", row.actor_pet_id).maybeSingle() : Promise.resolve({ data: null }),
    isLike ? pendingLikes(row.pet_id) : Promise.resolve(0),
  ]);
  return ((tokens ?? []) as Token[]).filter((token) => allowed(token, row.type)).flatMap((token) => {
    const text = describe(row.type, { ...(row.data ?? {}), pending }, actor?.pet_name ?? (token.language === "en" ? "A companion" : "Un compagnon"), pet.pet_name, token.language === "en");
    if (!text) return [];
    // The sender's avatar as the picture; my own pet's for its own news (level up). Never a liker's.
    const image = isLike ? null : actor?.photo_url || (row.actor_pet_id ? null : pet.photo_url) || null;
    const category = categoryOf(row.type, row.data ?? {});
    const outingSoon = row.type === "reminder" && row.data?.kind === "outing";
    return [{
      to: token.token,
      title: text.title,
      body: text.body,
      sound: "default",
      // An outing about to start is as pressing as the outing itself.
      channelId: outingSoon ? "outings" : CHANNEL[row.type] ?? "messages",
      priority: URGENT.has(row.type) || outingSoon ? "high" : "normal",
      // Not worth showing late: an outing reminder within the hour, the others within a day.
      ttl: outingSoon ? 3600 : URGENT.has(row.type) ? 7 * 86400 : 86400,
      ...(category ? { categoryId: category } : {}),
      ...(image ? { richContent: { image } } : {}),
      data: { id: row.id, type: row.type, petId: row.pet_id, actorPetId: row.actor_pet_id ?? null, matchId: row.data?.match_id ?? null },
    }];
  });
}

async function announcementMessages(row: Row) {
  const { data: tokens } = await supabase.from("push_tokens").select("token, language, prefs").eq("app", "grrrr");
  return ((tokens ?? []) as Token[]).filter((token) => allowed(token, row.type)).map((token) => {
    const en = token.language === "en";
    return {
      to: token.token,
      title: en ? row.title_en : row.title_fr,
      body: en ? row.body_en : row.body_fr,
      sound: "default",
      channelId: "news",
      priority: "normal",
      ttl: 3 * 86400,
      data: { id: `announcement:${row.id}`, type: row.type, url: row.url ?? null },
    };
  });
}

// GRRR Care: vaccines, vet visits, treatments, birthdays, tips (texts in both languages in data).
// Channels created by the Care app: vaccines, appointments, medications, health.
const CARE_URGENT = new Set(["visit", "medication"]);

async function careMessages(row: Row) {
  const { data: pet } = await supabase.from("pets").select("owner_id, pet_name, photo_url").eq("id", row.pet_id).maybeSingle();
  if (!pet) return [];
  const { data: tokens } = await supabase.from("push_tokens").select("token, language, prefs").eq("user_id", pet.owner_id).eq("app", "care");
  const data = row.data ?? {};
  return ((tokens ?? []) as Token[]).filter((token) => token.prefs?.[row.type] !== false).map((token) => {
    const en = token.language === "en";
    return {
      to: token.token,
      title: `${data.icon ? `${data.icon} ` : ""}${en ? data.titleEn ?? data.titleFr : data.titleFr ?? data.titleEn}`,
      body: en ? data.bodyEn ?? data.bodyFr ?? "" : data.bodyFr ?? data.bodyEn ?? "",
      sound: "default",
      channelId: data.channel ?? "health",
      priority: CARE_URGENT.has(row.type) ? "high" : "normal",
      ttl: row.type === "visit" ? 3 * 3600 : 86400,
      ...(pet.photo_url ? { richContent: { image: pet.photo_url } } : {}),
      data: { id: row.id, type: row.type, petId: row.pet_id, screen: data.screen ?? "health" },
    };
  });
}

Deno.serve(async (request) => {
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret || request.headers.get("x-webhook-secret") !== secret) return new Response("Forbidden", { status: 403 });

  const payload = await request.json().catch(() => null);
  if (payload?.type !== "INSERT" || !payload.record) return new Response("Ignored", { status: 200 });

  const messages = payload.table === "notifications" ? await notificationMessages(payload.record)
    : payload.table === "announcements" ? await announcementMessages(payload.record)
    : payload.table === "care_notifications" ? await careMessages(payload.record)
    : [];
  await send(messages);
  return new Response(JSON.stringify({ sent: messages.length }), { headers: { "Content-Type": "application/json" } });
});
