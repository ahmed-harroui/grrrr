import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { PetProgression, refreshPetProgress } from "@/data/api/progress";
import { CareStatus, getCareStatus } from "@/data/api/care";

// Server-computed XP / level of a database pet, refreshed each time the screen is shown.
export function usePetProgression(petDbId?: string) {
  const [progression, setProgression] = useState<PetProgression | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Call after anything that earns XP (profile saved, photos added...) to show it right away.
  const refresh = useCallback(async () => {
    if (!petDbId) return;
    const result = await refreshPetProgress(petDbId, false);
    setProgression(result.progression);
    setError(result.error);
  }, [petDbId]);

  useFocusEffect(
    useCallback(() => {
      if (!petDbId) {
        setProgression(null);
        setError(null);
        return;
      }
      let active = true;
      refreshPetProgress(petDbId).then((result) => {
        if (!active) return;
        setProgression(result.progression);
        setError(result.error);
      });
      return () => {
        active = false;
      };
    }, [petDbId])
  );
  return { progression, error, refresh };
}

// GRRRR Care health score of a database pet, computed like the Care app does.
export function useCareStatus(petDbId: string | undefined) {
  const [status, setStatus] = useState<CareStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!petDbId) {
        setStatus(null);
        return;
      }
      let active = true;
      getCareStatus(petDbId)
        .then((result) => active && setStatus(result))
        .catch(() => active && setStatus(null));
      return () => {
        active = false;
      };
    }, [petDbId])
  );
  return status;
}
