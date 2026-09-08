import { supabase } from "@/lib/supabase";

export interface ProfileRecord {
  user_id: string;
  pet_name: string;
  breed: string;
  age: number;
  city: string;
  bio: string;
  energy: 1 | 2 | 3 | 4;
  mode: number;
  photo_url: string;
  updated_at?: string;
}

export async function getProfile(userId: string) {
  if (!supabase) return { data: null, error: null };
  return supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle<ProfileRecord>();
}

export async function saveProfile(profile: ProfileRecord) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "user_id" });
  return { error };
}
