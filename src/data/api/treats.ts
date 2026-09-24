import { supabase } from "@/lib/supabase";

export type TreatReason = "match" | "outing";

export async function loadTreatBalance(petId: string) {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(petId)) return { balance: 0, error: null };
  const { data, error } = await supabase.from("pets").select("treats").eq("id", petId).maybeSingle<{ treats: number }>();
  return { balance: data?.treats ?? 0, error };
}

export async function awardTreats(petId: string, amount: number, reason: TreatReason, contextKey: string) {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(petId)) return { balance: null, awarded: true, error: null };
  const { data, error } = await supabase.rpc("award_treats", {
    p_pet_id: petId,
    p_amount: amount,
    p_reason: reason,
    p_context_key: contextKey,
  });
  return { balance: typeof data === "number" ? data : null, awarded: !error, error };
}
