import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { I18nManager } from "react-native";

import { LANGUAGES, TKey, translations } from "@/locales";

const STORAGE_KEY = "@haulbrokr_locale";

interface LanguageContextType {
  locale: string;
  isRTL: boolean;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  setLocale: (code: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getDeviceLocale(): string {
  const locales = Localization.getLocales();
  const langCode = locales[0]?.languageCode ?? "en";
  if (translations[langCode]) return langCode;
  const base = langCode.split("-")[0];
  if (translations[base]) return base;
  return "en";
}

function interpolate(
  str: string,
  params: Record<string, string | number>
): string {
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
    str
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<string>("en");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && translations[stored]) {
        setLocaleState(stored);
      } else {
        setLocaleState(getDeviceLocale());
      }
    });
  }, []);

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>): string => {
      const dict = translations[locale] ?? translations.en;
      const str = dict[key] ?? translations.en[key] ?? key;
      return params ? interpolate(str, params) : str;
    },
    [locale]
  );

  const setLocale = useCallback(async (code: string) => {
    setLocaleState(code);
    await AsyncStorage.setItem(STORAGE_KEY, code);
    const lang = LANGUAGES.find((l) => l.code === code);
    if (lang) {
      I18nManager.forceRTL(lang.rtl ?? false);
    }
  }, []);

  const lang = LANGUAGES.find((l) => l.code === locale);
  const isRTL = lang?.rtl ?? false;

  return (
    <LanguageContext.Provider value={{ locale, isRTL, t, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}
