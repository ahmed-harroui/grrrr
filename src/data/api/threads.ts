import { supabase } from "@/lib/supabase";

// Community threads, shared with the Grr website: the grr_threads tables of its schema live
// in this same database. Official threads are posted from the Sanity Studio when a guide is
// published; members post their own, here or on the site. One upvote per member per thread
// (grr_thread_likes); the counter is kept by a database trigger.

export type ThreadCategory = "fact" | "history" | "culture" | "science" | "story" | "tip";
// The website's animal families (strategie-ecosysteme-gr: lib/community/limits.ts, supabase/animals.sql).
export type ThreadAnimal = "all" | "dog" | "cat" | "rabbit" | "rodent" | "bird" | "fish" | "reptile" | "horse" | "ferret" | "farm";

/** [French, English] */
export const THREAD_CATEGORIES: Record<ThreadCategory, [string, string]> = {
  fact: ["Le savais-tu", "Fun fact"],
  history: ["Histoire", "History"],
  culture: ["Culture", "Culture"],
  science: ["Science", "Science"],
  story: ["Récit", "Story"],
  tip: ["Conseil", "Tip"],
};

export const THREAD_ANIMALS: Record<ThreadAnimal, [string, string]> = {
  all: ["Tous", "All pets"],
  dog: ["Chiens", "Dogs"],
  cat: ["Chats", "Cats"],
  rabbit: ["Lapins", "Rabbits"],
  rodent: ["Rongeurs", "Small rodents"],
  bird: ["Oiseaux", "Birds"],
  fish: ["Poissons", "Fish"],
  reptile: ["Reptiles", "Reptiles"],
  horse: ["Chevaux", "Horses"],
  ferret: ["Furets", "Ferrets"],
  farm: ["Basse-cour", "Farm animals"],
};

// Same limits as the database checks.
export const THREAD_LIMITS = { titleMin: 3, title: 120, bodyMin: 10, body: 1500 };

export interface Thread {
  id: string;
  authorId: string;
  title: string;
  body: string;
  category: ThreadCategory;
  animal: ThreadAnimal;
  /** Posted by Grr (from the Studio) */
  official: boolean;
  upvotes: number;
  comments: number;
  createdAt: string;
  authorName: string;
  authorAvatar: string;
  /** Upvoted by the signed-in member */
  upvoted: boolean;
}

const COLUMNS = "id, author_id, title, body, category, animal, is_official, like_count, comment_count, created_at, author:grr_members!grr_threads_author_id_fkey(username, display_name, avatar_url)";

function toThread(row: Record<string, any>, upvoted: boolean): Thread {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    category: row.category in THREAD_CATEGORIES ? row.category : "fact",
    animal: row.animal in THREAD_ANIMALS ? row.animal : "all",
    official: Boolean(row.is_official),
    upvotes: row.like_count ?? 0,
    comments: row.comment_count ?? 0,
    createdAt: row.created_at,
    authorName: row.is_official ? "GRRRR" : author?.display_name || author?.username || "",
    authorAvatar: author?.avatar_url ?? "",
    upvoted,
  };
}

/** Published threads, most upvoted first. */
export async function listThreads(userId?: string, limit = 60): Promise<Thread[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("grr_threads")
    .select(COLUMNS)
    .eq("status", "published")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("Threads could not be loaded", error.message);
    return [];
  }
  const rows = (data ?? []) as Record<string, any>[];
  let mine = new Set<string>();
  if (userId && rows.length > 0) {
    const { data: likes } = await supabase.from("grr_thread_likes").select("thread_id").eq("user_id", userId).in("thread_id", rows.map((row) => row.id));
    mine = new Set((likes ?? []).map((like) => like.thread_id));
  }
  return rows.map((row) => toThread(row, mine.has(row.id)));
}

/** The best threads first (most upvoted), then the ones nobody upvoted yet in a random order. */
export function rankThreads(threads: Thread[]): Thread[] {
  const best = threads.filter((thread) => thread.upvotes > 0).sort((a, b) => b.upvotes - a.upvotes || b.createdAt.localeCompare(a.createdAt));
  const rest = threads.filter((thread) => thread.upvotes <= 0);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...best, ...rest];
}

// Accounts created before the community tables have no member row yet (migration 014).
let memberReady: string | null = null;
async function ensureMember(userId: string) {
  if (!supabase || memberReady === userId) return;
  const { error } = await supabase.rpc("ensure_grr_member");
  if (error) console.warn("Community profile not ready", error.message);
  else memberReady = userId;
}

export async function setThreadUpvote(threadId: string, userId: string, upvoted: boolean): Promise<{ error: string | null }> {
  if (!supabase) return { error: "offline" };
  await ensureMember(userId);
  const { error } = upvoted
    ? await supabase.from("grr_thread_likes").insert({ thread_id: threadId, user_id: userId })
    : await supabase.from("grr_thread_likes").delete().eq("thread_id", threadId).eq("user_id", userId);
  // 23505: already upvoted (e.g. from the website), which is what was asked.
  if (!error || error.code === "23505") return { error: null };
  console.warn("Upvote not saved", error.message);
  return { error: error.message };
}

export type ThreadError = "DAILY_LIMIT" | "UNKNOWN";

export async function createThread(userId: string, input: { title: string; body: string; category: ThreadCategory; animal: ThreadAnimal }): Promise<{ thread: Thread | null; error: ThreadError | null }> {
  if (!supabase) return { thread: null, error: "UNKNOWN" };
  await ensureMember(userId);
  const { data, error } = await supabase
    .from("grr_threads")
    .insert({ author_id: userId, title: input.title.trim(), body: input.body.trim(), category: input.category, animal: input.animal })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    console.warn("Thread not posted", error?.message);
    return { thread: null, error: error?.message?.includes("Daily limit") ? "DAILY_LIMIT" : "UNKNOWN" };
  }
  return { thread: toThread(data as Record<string, any>, false), error: null };
}
