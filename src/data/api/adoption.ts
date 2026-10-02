import { supabase } from "@/lib/supabase";
import type { Pet } from "@/data/mockPets";
import { PetRecord, petRecordToPet } from "@/data/api/profile";

// Relation and adoption (migration 012). Two matched pets agree in their chat to have babies
// to entrust to adopters; once accepted the litter is listed in Explore > Adopt, where other
// owners answer it. Every write goes through a database function.

export type LitterStatus = "pending" | "accepted" | "declined" | "closed";

export interface Litter {
  id: string;
  fatherPetId: string;
  motherPetId: string;
  proposerPetId: string;
  status: LitterStatus;
}

/** Why a relation or an adoption request was refused by the database. */
export type AdoptionError = "NOT_MATCHED" | "DIFFERENT_SPECIES" | "SAME_GENDER" | "LITTER_CLOSED" | "OWN_LITTER" | "UNKNOWN";

export interface AdoptionParent {
  id: string;
  name: string;
  breed: string;
  age: number;
  city: string;
  bio: string;
  photo: string;
  /** The owner's display name ("" when not set) */
  owner: string;
  ownerAvatar: string;
}

export interface AdoptionListing {
  id: string;
  listedAt: string;
  species: string;
  father: AdoptionParent;
  mother: AdoptionParent;
  /** How many families already asked to adopt */
  requests: number;
}

const isUuid = (id?: string) => Boolean(id && /^[0-9a-f-]{36}$/i.test(id));
const ERRORS: AdoptionError[] = ["NOT_MATCHED", "DIFFERENT_SPECIES", "SAME_GENDER", "LITTER_CLOSED", "OWN_LITTER"];
const toError = (message?: string): AdoptionError => ERRORS.find((code) => message?.includes(code)) ?? "UNKNOWN";

function toLitter(row?: Record<string, any> | null): Litter | null {
  if (!row?.id) return null;
  return { id: row.id, fatherPetId: row.father_pet_id, motherPetId: row.mother_pet_id, proposerPetId: row.proposer_pet_id, status: row.status };
}

/** The relation between two pets, whatever its status (null when none was ever proposed). */
export async function getLitter(petA?: string, petB?: string): Promise<Litter | null> {
  if (!supabase || !isUuid(petA) || !isUuid(petB)) return null;
  const { data, error } = await supabase
    .from("pet_litters")
    .select("id, father_pet_id, mother_pet_id, proposer_pet_id, status")
    .or(`and(father_pet_id.eq.${petA},mother_pet_id.eq.${petB}),and(father_pet_id.eq.${petB},mother_pet_id.eq.${petA})`)
    .maybeSingle();
  if (error) console.warn("Relation could not be loaded", error.message);
  return toLitter(data);
}

export async function proposeLitter(petId: string, otherPetId: string): Promise<{ litter: Litter | null; error: AdoptionError | null }> {
  if (!supabase) return { litter: null, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("propose_litter", { p_pet_id: petId, p_other_pet_id: otherPetId });
  return { litter: toLitter(data), error: error ? toError(error.message) : null };
}

export async function respondToLitter(litterId: string, accept: boolean): Promise<{ litter: Litter | null; error: AdoptionError | null }> {
  if (!supabase) return { litter: null, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("respond_to_litter", { p_litter_id: litterId, p_accept: accept });
  return { litter: toLitter(data), error: error ? toError(error.message) : null };
}

/** Cancels a pending proposal, or removes a listed litter from Adopt. */
export async function closeLitter(litterId: string): Promise<{ litter: Litter | null; error: AdoptionError | null }> {
  if (!supabase) return { litter: null, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("close_litter", { p_litter_id: litterId });
  return { litter: toLitter(data), error: error ? toError(error.message) : null };
}

function toParent(row: Record<string, any>): AdoptionParent {
  return { id: row.id, name: row.name ?? "", breed: row.breed ?? "", age: row.age ?? 0, city: row.city ?? "", bio: row.bio ?? "", photo: row.photo ?? "", owner: row.owner ?? "", ownerAvatar: row.owner_avatar ?? "" };
}

/** Listed litters my pet has not answered yet, newest first. */
export async function getAdoptionFeed(petId?: string): Promise<AdoptionListing[]> {
  if (!supabase || !isUuid(petId)) return [];
  const { data, error } = await supabase.rpc("get_adoption_feed", { p_pet_id: petId });
  if (error) {
    console.warn("Adoption feed could not be loaded", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, any>[]).map((row) => ({
    id: row.litter_id,
    listedAt: row.listed_at,
    species: row.litter_species,
    father: toParent(row.father ?? {}),
    mother: toParent(row.mother ?? {}),
    requests: row.requests ?? 0,
  }));
}

/** What the family wants from the babies (migration 016). */
export type AdoptionIntent = "ADOPT" | "BUY";

/** A pet my family waits for (swiped up in Discover, migration 015). */
export interface AdoptionInterest {
  pet: Pet;
  since: string;
  intent: AdoptionIntent;
}

/** Swipe up in Discover: nothing is sent now; the request leaves when this pet has a litter listed. */
export async function addAdoptionInterest(petId?: string, adopterPetId?: string, intent: AdoptionIntent = "ADOPT"): Promise<{ error: string | null }> {
  if (!supabase || !isUuid(petId) || !isUuid(adopterPetId)) return { error: null };
  let { error } = await supabase.from("adoption_interests").insert({ pet_id: petId, adopter_pet_id: adopterPetId, intent });
  // Before migration 016 the choice has no column yet: the wait is still saved, as an adoption.
  if (error?.code === "PGRST204") ({ error } = await supabase.from("adoption_interests").insert({ pet_id: petId, adopter_pet_id: adopterPetId }));
  // 23505: already waiting for this pet.
  if (!error || error.code === "23505") return { error: null };
  // 5 families already wait for this pet (migration 022).
  if (error.message?.includes("WAITLIST_FULL")) return { error: "WAITLIST_FULL" };
  console.warn("Adoption interest not saved", error.message);
  return { error: error.message };
}

/** The owner removes a family waiting for their pet: it makes room for another (5 at most). */
export async function removeWaitingFamily(petId: string, adopterPetId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("adoption_interests").delete().eq("pet_id", petId).eq("adopter_pet_id", adopterPetId);
  if (error) console.warn("Waiting family not removed", error.message);
  return !error;
}

/** Most families that can wait for one pet (same limit as the database). */
export const WAITLIST_LIMIT = 5;

export async function removeAdoptionInterest(petId: string, adopterPetId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("adoption_interests").delete().eq("pet_id", petId).eq("adopter_pet_id", adopterPetId);
  if (error) console.warn("Adoption interest not removed", error.message);
}

/** The pets my family waits for, newest first. */
export async function getAdoptionInterests(adopterPetId?: string): Promise<AdoptionInterest[]> {
  if (!supabase || !isUuid(adopterPetId)) return [];
  const { data, error } = await supabase
    .from("adoption_interests")
    .select("*, pet:pets!adoption_interests_pet_id_fkey(*)")
    .eq("adopter_pet_id", adopterPetId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("Adoption interests could not be loaded", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, any>[])
    .map((row) => ({ record: (Array.isArray(row.pet) ? row.pet[0] : row.pet) as PetRecord | null, since: row.created_at as string, intent: (row.intent === "BUY" ? "BUY" : "ADOPT") as AdoptionIntent }))
    .filter((row): row is { record: PetRecord; since: string; intent: AdoptionIntent } => Boolean(row.record))
    .map((row) => ({ pet: petRecordToPet(row.record), since: row.since, intent: row.intent }));
}

/** The families that swiped my pet up: they wait for its babies, to adopt or to buy (migration 021). */
export async function getWaitingForMyPet(petId?: string): Promise<AdoptionInterest[]> {
  if (!supabase || !isUuid(petId)) return [];
  const { data, error } = await supabase
    .from("adoption_interests")
    .select("*, adopter:pets!adoption_interests_adopter_pet_id_fkey(*)")
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("Waiting families could not be loaded", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, any>[])
    .map((row) => ({ record: (Array.isArray(row.adopter) ? row.adopter[0] : row.adopter) as PetRecord | null, since: row.created_at as string, intent: (row.intent === "BUY" ? "BUY" : "ADOPT") as AdoptionIntent }))
    .filter((row): row is { record: PetRecord; since: string; intent: AdoptionIntent } => Boolean(row.record))
    .map((row) => ({ pet: petRecordToPet(row.record), since: row.since, intent: row.intent }));
}

/** Adopt: both parents receive the request in a conversation with my pet. Skip: the litter is not shown again. */
export async function answerAdoption(litterId: string, petId: string, adopt: boolean): Promise<{ sent: boolean; error: AdoptionError | null }> {
  if (!supabase) return { sent: false, error: "UNKNOWN" };
  const { data, error } = await supabase.rpc("answer_adoption", { p_litter_id: litterId, p_pet_id: petId, p_adopt: adopt });
  return { sent: data === true, error: error ? toError(error.message) : null };
}
