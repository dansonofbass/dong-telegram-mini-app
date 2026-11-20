import { it, expect } from "vitest";
import { dictionaries, en, initialLocale, supportedLocale } from "../src/i18n";
it("all six dictionaries match the English keys and contain nonempty strings", () => {
  expect(Object.keys(dictionaries)).toEqual([
    "en",
    "fa",
    "hy",
    "de",
    "fr",
    "ru",
  ]);
  for (const dictionary of Object.values(dictionaries)) {
    expect(Object.keys(dictionary).sort()).toEqual(Object.keys(en).sort());
    expect(
      Object.values(dictionary).every(
        (value) => typeof value === "string" && value.trim(),
      ),
    ).toBe(true);
  }
});
it("respects a saved choice before Telegram/browser and maps regional variants", () => {
  expect(initialLocale("fr", "fa", "de-DE")).toBe("fr");
  expect(initialLocale(null, "hy-AM", "en-US")).toBe("hy");
  expect(initialLocale(null, undefined, "ru_RU")).toBe("ru");
  expect(initialLocale("invalid", "es", "de")).toBe("en");
  for (const locale of ["en", "fa", "hy", "de", "fr", "ru"])
    expect(supportedLocale(locale + "-XX")).toBe(locale);
});
