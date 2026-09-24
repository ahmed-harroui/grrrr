import { useLocalization } from "@/context/LocalizationContext";
import { translations } from "./translations";

export function useTranslation() {
  const { language } = useLocalization();
  const t = translations[language];

  return {
    t,
    language,
  };
}
