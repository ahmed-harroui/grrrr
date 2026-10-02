import { supabase } from "@/lib/supabase";
import type { Pet } from "@/data/mockPets";

export interface AccountProfileRecord {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  updated_at?: string;
}

export interface PetRecord {
  id?: string;
  owner_id: string;
  pet_name: string;
  species: string;
  breed: string;
  age: number;
  city: string;
  bio: string;
  energy: 1 | 2 | 3 | 4;
  mode: number;
  photo_url: string;
  /** Gallery pictures shown after the avatar */
  photos?: string[];
  tags: string[];
  level?: number;
  xp?: number;
  gender?: string;
  country?: string | null;
  /** Test pets owned by the bot account; they like back automatically */
  is_bot?: boolean;
  /** Starter pet created with the account (migration 008), filled by the pet setup screen */
  setup_pending?: boolean;
  /** Family profile of an account that came to adopt (migration 015): hidden from Discover and Trending */
  adopter_only?: boolean;
  // Health fields, also edited in GRRRR Care
  birthday?: string | null;
  weight?: number | null;
  microchip?: string | null;
  sterilized?: boolean | null;
  color?: string | null;
  allergies?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getAccountProfile(userId: string) {
  if (!supabase) return { data: null, error: null };
  return supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle<AccountProfileRecord>();
}

export async function saveAccountProfile(profile: AccountProfileRecord) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "user_id" });
  return { error };
}

export async function createPetProfile(pet: PetRecord) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pets").insert(pet);
  return { error };
}

export async function getPrimaryPetProfile(ownerId: string) {
  if (!supabase) return { data: null, error: null };
  return supabase
    .from("pets")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<PetRecord>();
}

export async function getOwnedPetProfiles(ownerId: string) {
  if (!supabase) return { data: [] as PetRecord[], error: null };
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as PetRecord[], error };
}

// The UI keys pets by number; database pets get a stable hash of their UUID.
export function stablePetId(id: string) {
  return Array.from(id).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
}

// Cards without a picture yet (e.g. starter pets) still get one.
const placeholderPhoto = (species: string, id: number) =>
  species === "cat" ? `https://cataas.com/cat/cute?width=600&height=700&r=${id % 50}` : `https://placedog.net/600/700?id=${1 + (id % 200)}`;

export function petRecordToPet(record: PetRecord): Pet {
  const id = stablePetId(record.id ?? record.owner_id);
  // A family profile gets no stand-in pet picture.
  const photo = record.photo_url || (record.adopter_only ? "" : placeholderPhoto(record.species, id));
  return {
    id,
    dbId: record.id,
    name: record.pet_name,
    species: record.species as Pet["species"],
    breed: record.breed,
    gender: record.gender === "M" ? "M" : "F",
    age: record.age,
    energy: record.energy,
    dist: 2 + (id % 18),
    mode: record.mode,
    bio: record.bio,
    tags: record.tags ?? [],
    photo,
    photos: [photo, ...(record.photos ?? [])].filter(Boolean),
    city: record.city,
    country: record.country ?? undefined,
    level: record.level,
    xp: record.xp ?? 0,
    isBot: record.is_bot ?? false,
    setupPending: record.setup_pending ?? false,
    adopterOnly: record.adopter_only ?? false,
    health: {
      birthday: record.birthday ?? null,
      weight: record.weight ?? null,
      microchip: record.microchip ?? null,
      sterilized: record.sterilized ?? null,
      color: record.color ?? null,
      allergies: record.allergies ?? null,
    },
  };
}

export async function getDiscoverablePetProfiles(ownerId?: string) {
  if (!supabase) return { data: [], error: null };
  let query = supabase.from("pets").select("*").order("created_at", { ascending: false });
  if (ownerId) query = query.neq("owner_id", ownerId);
  const { data, error } = await query;
  return { data: ((data ?? []) as PetRecord[]).filter((pet) => !pet.adopter_only), error };
}

/** Trending profiles: the pets with the most XP in the database, every account included. */
export async function getTopXpPetProfiles(limit = 60) {
  if (!supabase) return { data: [] as PetRecord[], error: null };
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .order("xp", { ascending: false })
    .order("level", { ascending: false })
    .limit(limit);
  return { data: ((data ?? []) as PetRecord[]).filter((pet) => !pet.adopter_only), error };
}

export async function getPetsByIds(ids: string[]) {
  if (!supabase || ids.length === 0) return { data: [] as PetRecord[], error: null };
  const { data, error } = await supabase.from("pets").select("*").in("id", ids);
  return { data: (data ?? []) as PetRecord[], error };
}

const PET_PHOTOS_BUCKET = "pet-photos";
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64: string) {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((offset) => BASE64_CHARS.indexOf(clean[i + offset] ?? "A"));
    const value = (chunk[0] << 18) | (chunk[1] << 12) | (chunk[2] << 6) | chunk[3];
    if (byteIndex < bytes.length) bytes[byteIndex++] = (value >> 16) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (value >> 8) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = value & 0xff;
  }
  return bytes;
}

export interface LocalPhoto {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
}

export const isRemotePhoto = (uri: string) => /^https?:\/\//.test(uri);

/** Uploads a picked image to Storage and returns its public URL (remote URLs pass through). */
export async function uploadPetPhoto(ownerId: string, photo: LocalPhoto): Promise<{ url: string; error: Error | null }> {
  if (!supabase || isRemotePhoto(photo.uri)) return { url: photo.uri, error: null };
  if (!photo.base64) return { url: "", error: new Error("Image illisible, choisis-la à nouveau.") };
  const contentType = photo.mimeType ?? "image/jpeg";
  const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(PET_PHOTOS_BUCKET).upload(path, base64ToBytes(photo.base64), { contentType });
  if (error) return { url: "", error };
  return { url: supabase.storage.from(PET_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl, error: null };
}

/** "I came to adopt": the starter pet becomes the family profile, named after the account. */
export async function becomeAdopter(ownerId: string, starterPetId: string | null, familyName: string) {
  if (!supabase) return { error: null };
  const { data: account } = await getAccountProfile(ownerId);
  const changes = { pet_name: familyName, bio: "", photo_url: account?.avatar_url ?? "", adopter_only: true, setup_pending: false };
  if (starterPetId) return updatePetProfile(starterPetId, ownerId, changes);
  return createPetProfile({ ...changes, owner_id: ownerId, species: "dog", breed: "", age: 0, city: "", energy: 2, mode: 0, tags: [] });
}

/** Deletes one of my pets; its swipes, matches and messages go with it (on delete cascade). */
export async function deletePetProfile(petId: string, ownerId: string) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pets").delete().eq("id", petId).eq("owner_id", ownerId);
  return { error };
}

export async function updatePetProfile(petId: string, ownerId: string, changes: Partial<PetRecord>) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pets").update(changes).eq("id", petId).eq("owner_id", ownerId);
  return { error };
}
