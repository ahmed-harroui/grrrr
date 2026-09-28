import { useCallback } from "react";
import { useLocalization } from "@/context/LocalizationContext";
import { Language, translations } from "./translations";

// Picks the text matching the language, for code outside React components.
export function pick(language: Language, fr: string, en: string) {
  return language === "en" ? en : fr;
}

export function useTranslation() {
  const { language } = useLocalization();
  const t = translations[language];
  // Inline pair for one-off UI texts: tx("Bonjour", "Hello").
  const tx = useCallback((fr: string, en: string) => pick(language, fr, en), [language]);

  return {
    t,
    tx,
    language,
  };
}
