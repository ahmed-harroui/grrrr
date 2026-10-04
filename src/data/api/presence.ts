import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";

// Who is around on the Explore map (migration 028). Nothing is shared unless the owner switches
// it on; the database only keeps a rounded position (about 500 m) and erases it after a day.
//   off      not on the map (default)
//   friends  my matches see my pet
//   area     my matches see my pet; everyone else sees only a count per district
export type MapVisibility = "off" | "friends" | "area";

export type FriendOnMap = { petId: string; name: string; photo: string; species: string; latitude: number; longitude: number; updatedAt: string };
export type MapBubble = { latitude: number; longitude: number; pets: number };

const isUuid = (value?: string): value is string => Boolean(value && /^[0-9a-f-]{36}$/i.test(value));

export async function getMapVisibility(userId?: string): Promise<MapVisibility> {
  if (!supabase || !userId) return "off";
  const { data } = await supabase.from("profiles").select("map_visibility").eq("user_id", userId).maybeSingle();
  return data?.map_visibility === "friends" || data?.map_visibility === "area" ? data.map_visibility : "off";
}

/** Saves the choice; "off" also erases my position at once. */
export async function setMapVisibility(visibility: MapVisibility): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("set_map_visibility", { p_visibility: visibility });
  if (error) console.warn("Map visibility not saved", error.message);
  return !error;
}

/** Where I am, to the precision the phone gives for an approximate position; null when refused. */
export async function getMyPosition(ask: boolean): Promise<{ latitude: number; longitude: number } | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted" && ask) status = (await Location.requestForegroundPermissionsAsync()).status;
    if (status !== "granted") return null;
    const found = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return found ? { latitude: found.coords.latitude, longitude: found.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** Sends my pet's position (the database rounds it, or drops it when I am not on the map). */
export async function shareMyPosition(petId: string | undefined, position: { latitude: number; longitude: number }) {
  if (!supabase || !isUuid(petId)) return;
  const { error } = await supabase.rpc("update_my_location", { p_pet_id: petId, p_latitude: position.latitude, p_longitude: position.longitude });
  if (error) console.warn("Position not shared", error.message);
}

/** My pet's matches who are on the map and were active in the last hours. */
export async function getFriendsOnMap(petId?: string): Promise<FriendOnMap[]> {
  if (!supabase || !isUuid(petId)) return [];
  const { data, error } = await supabase.rpc("get_friends_on_map", { p_pet_id: petId });
  if (error) {
    console.warn("Friends on the map could not be loaded", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, any>[]).map((row) => ({ petId: row.pet_id, name: row.pet_name, photo: row.photo_url ?? "", species: row.species ?? "", latitude: row.latitude, longitude: row.longitude, updatedAt: row.updated_at }));
}

/** Everyone else around: how many pets per district, never who. */
export async function getMapBubbles(petId: string | undefined, center: { latitude: number; longitude: number }): Promise<MapBubble[]> {
  if (!supabase || !isUuid(petId)) return [];
  const { data, error } = await supabase.rpc("get_map_bubbles", { p_pet_id: petId, p_latitude: center.latitude, p_longitude: center.longitude });
  if (error) {
    console.warn("Map bubbles could not be loaded", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, any>[]).map((row) => ({ latitude: row.latitude, longitude: row.longitude, pets: row.pets }));
}
