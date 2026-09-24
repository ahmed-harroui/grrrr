import {
  Swipe,
  SwipeAction,
} from "../types/swipe";
import { supabase } from "@/lib/supabase";

const swipeHistory: Swipe[] = [];

export async function createSwipe(
  fromPetId: string,
  toPetId: string,
  action: SwipeAction
): Promise<Swipe> {
  if (supabase) {
    const { data, error } = await supabase
      .from("pet_swipes")
      .upsert(
        { from_pet_id: fromPetId, to_pet_id: toPetId, action },
        { onConflict: "from_pet_id,to_pet_id" }
      )
      .select("id, from_pet_id, to_pet_id, action, created_at")
      .single();

    if (error) throw error;
    return {
      id: data.id,
      fromPetId: data.from_pet_id,
      toPetId: data.to_pet_id,
      action: data.action as SwipeAction,
      createdAt: data.created_at,
    };
  }

  const swipe: Swipe = {
    id: `swipe_${Date.now()}`,
    fromPetId,
    toPetId,
    action,
    createdAt: new Date().toISOString(),
  };

  swipeHistory.push(swipe);

  return Promise.resolve(swipe);
}

export async function getSwipeHistory(
  petId: string
): Promise<Swipe[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("pet_swipes")
      .select("id, from_pet_id, to_pet_id, action, created_at")
      .eq("from_pet_id", petId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((swipe) => ({
      id: swipe.id,
      fromPetId: swipe.from_pet_id,
      toPetId: swipe.to_pet_id,
      action: swipe.action as SwipeAction,
      createdAt: swipe.created_at,
    }));
  }

  return Promise.resolve(
    swipeHistory.filter(
      (swipe) =>
        swipe.fromPetId === petId
    )
  );
}

export async function hasAlreadySwiped(
  fromPetId: string,
  toPetId: string
): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase
      .from("pet_swipes")
      .select("id")
      .eq("from_pet_id", fromPetId)
      .eq("to_pet_id", toPetId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  return Promise.resolve(
    swipeHistory.some(
      (swipe) =>
        swipe.fromPetId === fromPetId &&
        swipe.toPetId === toPetId
    )
  );
}