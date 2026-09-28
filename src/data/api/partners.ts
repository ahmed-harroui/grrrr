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

// Only published partners with usable coordinates can be pinned on the map.
export async function getPartners(): Promise<Partner[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLUMNS)
    .eq("is_published", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
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
