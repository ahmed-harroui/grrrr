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

export function petRecordToPet(record: PetRecord): Pet {
  const id = stablePetId(record.id ?? record.owner_id);
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
    photo: record.photo_url,
    photos: [record.photo_url, ...(record.photos ?? [])].filter(Boolean),
    city: record.city,
    level: record.level,
  };
}

export async function getDiscoverablePetProfiles(ownerId?: string) {
  if (!supabase) return { data: [], error: null };
  let query = supabase.from("pets").select("*").order("created_at", { ascending: false });
  if (ownerId) query = query.neq("owner_id", ownerId);
  const { data, error } = await query;
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

export async function updatePetProfile(petId: string, ownerId: string, changes: Partial<PetRecord>) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pets").update(changes).eq("id", petId).eq("owner_id", ownerId);
  return { error };
}
