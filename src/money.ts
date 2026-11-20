import { precision, type Currency } from "../shared/engine";
import { localeTag } from "./i18n";
/** Presentation only: persisted values and calculations always use integer minor units. */
export function formatMoney(
  amount: number,
  currency: Currency,
  locale: string,
): string {
  const digits = precision(currency);
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };
  if (currency === "EUR")
    return new Intl.NumberFormat(localeTag(locale), {
      ...options,
      style: "currency",
      currency: "EUR",
      currencyDisplay: "symbol",
    }).format(amount / 100);
  return (
    new Intl.NumberFormat(localeTag(locale), options).format(
      amount / 10 ** digits,
    ) +
    " " +
    currency
  );
}
