import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { Language } from "@/i18n/translations";

interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem("@grrrr_language");
        if (saved === "en" || saved === "fr") {
          setLanguageState(saved);
        } else {
          const locale = Localization.getLocales()[0]?.languageCode;
          setLanguageState(locale === "en" ? "en" : "fr");
        }
      } catch (error) {
        setLanguageState("fr");
      } finally {
        setIsLoaded(true);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem("@grrrr_language", lang);
    } catch (error) {
      console.error("Failed to save language", error);
    }
  };

  return (
    <LocalizationContext.Provider value={{ language, setLanguage }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error("useLocalization must be used within LocalizationProvider");
  return ctx;
}
