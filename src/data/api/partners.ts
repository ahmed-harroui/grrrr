import { supabase } from "@/lib/supabase";

export type PartnerCategory = "clinic" | "pharmacy" | "supplies" | "grooming" | (string & {});

export type Partner = {
  id: string;
  name: string;
  category: PartnerCategory;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  is_featured: boolean;
  logo_url: string | null;
  services: string[] | null;
};

const PARTNER_COLUMNS = "id, name, category, description, address, phone, email, website, latitude, longitude, rating, is_featured, logo_url, services";

// The table holds every vet, pet shop and groomer of the country (GRRR Care migration 018): the map only
// gets the published places around the point it shows, about 45 km each way, never the whole list.
const AROUND_DEGREES = 0.4;
const MAX_PLACES = 400;

export async function getPartners(center: { latitude: number; longitude: number }): Promise<Partner[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLUMNS)
    .eq("is_published", true)
    .gte("latitude", center.latitude - AROUND_DEGREES)
    .lte("latitude", center.latitude + AROUND_DEGREES)
    .gte("longitude", center.longitude - AROUND_DEGREES * 1.4)
    .lte("longitude", center.longitude + AROUND_DEGREES * 1.4)
    // Establishments that joined GRRR Care first, so they are never the ones left out
    .order("is_partner", { ascending: false })
    .limit(MAX_PLACES);
  if (error) throw error;
  return (data ?? []) as Partner[];
}

// Calls onChange whenever a partner is added, edited or removed in Supabase.
export function subscribeToPartners(onChange: () => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel("partners-map")
    .on("postgres_changes", { event: "*", schema: "public", table: "partners" }, onChange)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
