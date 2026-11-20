import type { Currency } from "../shared/engine";
import type { Locale } from "./i18n";
export function getDefaultCurrencyForLanguage(language: Locale): Currency {
  const defaults: Record<Locale, Currency> = {
    en: "USD",
    fa: "USD",
    hy: "AMD",
    ru: "AMD",
    de: "EUR",
    fr: "EUR",
  };
  return defaults[language];
}
export type DashboardBalance = {
  currency: Currency;
  owed: number;
  receivable: number;
};
/** Presentation only: retain each active currency and never net debt against receivables. */
export function getDashboardBalances(
  totals: readonly DashboardBalance[],
  language: Locale,
): DashboardBalance[] {
  const active = totals.filter(
    (balance) => balance.owed !== 0 || balance.receivable !== 0,
  );
  return active.length
    ? active
    : [
        {
          currency: getDefaultCurrencyForLanguage(language),
          owed: 0,
          receivable: 0,
        },
      ];
}
