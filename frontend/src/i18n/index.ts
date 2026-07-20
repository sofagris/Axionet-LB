import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import nb from "./locales/nb.json";

export const SUPPORTED_LOCALES = ["nb", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "axionet-locale";

function resolveLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "nb";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "nb" || stored === "en") {
    return stored;
  }
  return "nb";
}

void i18n.use(initReactI18next).init({
  resources: {
    nb: { translation: nb },
    en: { translation: en },
  },
  lng: resolveLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
  if (typeof window !== "undefined" && (lng === "nb" || lng === "en")) {
    window.localStorage.setItem(STORAGE_KEY, lng);
  }
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
}

export function setAppLocale(locale: AppLocale) {
  void i18n.changeLanguage(locale);
}

export default i18n;
