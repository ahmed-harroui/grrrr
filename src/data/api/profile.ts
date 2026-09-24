import { supabase } from "@/lib/supabase";

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

export async function getDiscoverablePetProfiles(ownerId?: string) {
  if (!supabase) return { data: [], error: null };
  let query = supabase.from("pets").select("*").order("created_at", { ascending: false });
  if (ownerId) query = query.neq("owner_id", ownerId);
  const { data, error } = await query;
  return { data: (data ?? []) as PetRecord[], error };
}

export async function updatePetProfile(petId: string, ownerId: string, changes: Partial<PetRecord>) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pets").update(changes).eq("id", petId).eq("owner_id", ownerId);
  return { error };
}
