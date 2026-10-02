import type { AppNotification } from "@/data/api/notifications";
import type { Language } from "@/i18n/translations";
import { pick } from "@/i18n/useTranslation";

/** What a notification says: a small type icon, a title and one or two lines of text. */
export function describeNotification(notification: AppNotification, language: Language, myPetName: string): { icon: string; title: string; body: string } {
  const tx = (fr: string, en: string) => pick(language, fr, en);
  const { data } = notification;
  const actor = notification.actor?.name || tx("Un compagnon", "A companion");
  const hot = data.intent === "HOT" || data.match_type === "LOVE";
  const mood = hot ? "Hot ✦" : "Friend 🐾";

  switch (notification.type) {
    case "message":
      return { icon: "💬", title: actor, body: data.preview ?? tx("Nouveau message", "New message") };
    case "meeting":
      // A proposal, an answer or a cancellation: the message itself says which.
      return { icon: "📍", title: tx(`Sortie avec ${actor}`, `Outing with ${actor}`), body: data.preview ?? tx("Ouvre le chat pour voir la sortie.", "Open the chat to see the outing.") };
    case "relation":
      return { icon: "💞", title: tx(`Relation avec ${actor}`, `Relationship with ${actor}`), body: data.preview ?? tx("Ouvre le chat pour répondre.", "Open the chat to answer.") };
    case "adoption":
      return { icon: "🍼", title: tx("Demande d'adoption", "Adoption request"), body: data.preview ?? tx(`${actor} aimerait adopter un bébé de ${myPetName}.`, `${actor} would like to adopt one of ${myPetName}'s babies.`) };
    case "adoption_interest":
      return data.intent === "BUY"
        ? { icon: "💶", title: tx(`${actor} aimerait acheter un bébé de ${myPetName}`, `${actor} would like to buy one of ${myPetName}'s babies`), body: tx("Sa demande partira dès que tu proposeras une portée. Retrouve-le dans Matchs.", "Their request leaves as soon as you offer a litter. Find them in Matches.") }
        : { icon: "🍼", title: tx(`${actor} aimerait adopter un bébé de ${myPetName}`, `${actor} would like to adopt one of ${myPetName}'s babies`), body: tx("Sa demande partira dès que tu proposeras une portée. Retrouve-le dans Matchs.", "Their request leaves as soon as you offer a litter. Find them in Matches.") };
    case "adoption_listed":
      return { icon: "🍼", title: tx(`${actor} a des bébés à adopter !`, `${actor} has babies to adopt!`), body: tx("Ta demande est partie chez les deux parents : réponds-leur dans Messages.", "Your request went to both parents: answer them in Messages.") };
    case "like":
      return { icon: "💌", title: tx(`${actor} a liké ${myPetName}`, `${actor} liked ${myPetName}`), body: tx(`Un like ${mood} · like en retour dans Discover.`, `A ${mood} like · like back in Discover.`) };
    case "super_like":
      return { icon: "⭐", title: tx(`Super like de ${actor} !`, `Super like from ${actor}!`), body: tx(`${myPetName} lui a tapé dans l'œil · like en retour dans Discover.`, `${myPetName} caught their eye · like back in Discover.`) };
    case "match":
      return { icon: hot ? "❤️" : "🐾", title: tx(`Match ${mood} avec ${actor} !`, `${mood} match with ${actor}!`), body: tx(`${myPetName} et ${actor} se sont plu. Dis-lui bonjour !`, `${myPetName} and ${actor} like each other. Say hello!`) };
    case "level_up":
      return { icon: "🏆", title: tx(`${myPetName} passe niveau ${data.level ?? ""}`, `${myPetName} reached level ${data.level ?? ""}`), body: tx("Un nouveau rang à découvrir sur son profil.", "A new rank to discover on their profile.") };
    case "birthday":
      return { icon: "🎂", title: tx(`Joyeux anniversaire ${myPetName} !`, `Happy birthday ${myPetName}!`), body: tx("Une friandise et une belle balade pour fêter ça.", "A treat and a nice walk to celebrate.") };
    case "welcome":
      return { icon: "🐾", title: tx(`Bienvenue ${myPetName} !`, `Welcome ${myPetName}!`), body: tx("Likes, matchs, messages et nouveautés arriveront ici.", "Likes, matches, messages and news will show up here.") };
    default: {
      // Announcements and care tips carry their own texts in both languages.
      const icon = notification.type === "reminder" ? data.icon ?? "🐾" : notification.type === "store" ? "🛍️" : notification.type === "thread" ? "🧵" : notification.type === "care" ? "🩺" : "📣";
      return { icon, title: tx(data.titleFr ?? "GRRRR", data.titleEn ?? data.titleFr ?? "GRRRR"), body: tx(data.bodyFr ?? "", data.bodyEn ?? data.bodyFr ?? "") };
    }
  }
}

/** "à l'instant", "5 min", "3 h", "2 j", then the date. */
export function timeAgo(iso: string, language: Language) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return pick(language, "à l'instant", "just now");
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return pick(language, `${days} j`, `${days} d`);
  return new Date(iso).toLocaleDateString(language === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });
}
