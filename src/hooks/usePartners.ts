import { useCallback, useEffect, useState } from "react";
import { getPartners, Partner, subscribeToPartners } from "@/data/api/partners";

// Loads the partner places and keeps them in sync with Supabase in real time.
export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);

  const refresh = useCallback(() => {
    getPartners()
      .then(setPartners)
      .catch((error) => console.warn("Partners could not be loaded", error));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToPartners(refresh);
  }, [refresh]);

  return { partners, refresh };
}
