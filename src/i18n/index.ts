import { en } from "./en";
import { fa } from "./fa";
import { hy } from "./hy";
import { de } from "./de";
import { fr } from "./fr";
import { ru } from "./ru";
export { en, fa };
export type Key = keyof typeof en;
export const locales = ["en", "fa", "hy", "de", "fr", "ru"] as const;
export type Locale = (typeof locales)[number];
export const dictionaries: Record<Locale, Record<Key, string>> = {
  en,
  fa,
  hy,
  de,
  fr,
  ru,
};
export const languageOptions = [
  { value: "en", flag: "🇺🇸", name: "English" },
  { value: "fa", flag: "🇮🇷", name: "فارسی" },
  { value: "hy", flag: "🇦🇲", name: "Հայերեն" },
  { value: "de", flag: "🇩🇪", name: "Deutsch" },
  { value: "fr", flag: "🇫🇷", name: "Français" },
  { value: "ru", flag: "🇷🇺", name: "Русский" },
] as const;
export function supportedLocale(
  value: string | null | undefined,
): Locale | undefined {
  const base = value?.toLowerCase().replaceAll("_", "-").split("-")[0];
  return locales.find((locale) => locale === base);
}
export function initialLocale(
  saved: string | null,
  telegram?: string,
  browser?: string,
): Locale {
  return supportedLocale(saved) || supportedLocale(telegram || browser) || "en";
}
export const localeTag = (locale: string) =>
  locale === "fa" ? "fa-IR" : locale === "en" ? "en-US" : locale;
