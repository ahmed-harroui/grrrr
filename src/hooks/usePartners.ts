import { useCallback, useEffect, useState } from "react";
import { getPartners, Partner, subscribeToPartners } from "@/data/api/partners";

// Loads the places around a point and keeps them in sync with Supabase in real time.
export function usePartners(center: { latitude: number; longitude: number }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const { latitude, longitude } = center;

  const refresh = useCallback(() => {
    getPartners({ latitude, longitude })
      .then(setPartners)
      .catch((error) => console.warn("Partners could not be loaded", error));
  }, [latitude, longitude]);

  useEffect(() => {
    refresh();
    return subscribeToPartners(refresh);
  }, [refresh]);

  return { partners, refresh };
}
