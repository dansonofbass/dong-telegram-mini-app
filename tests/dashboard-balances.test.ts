import { describe, it, expect } from "vitest";
import {
  getDashboardBalances,
  getDefaultCurrencyForLanguage,
} from "../src/dashboard-balances";
import { formatMoney } from "../src/money";
import { locales } from "../src/i18n";
import { accountBalances } from "../shared/balances";
import type { Hangout, Currency } from "../shared/engine";
function ledger(currency: Currency): Hangout {
  return {
    id: currency,
    title: "Bill",
    description: "",
    date: "2026-11-21",
    icon: "dinner",
    currency,
    ownerId: "payer",
    inviteToken: currency,
    preferences: {},
    members: [
      { id: "p", userId: "payer", name: "Payer" },
      { id: "d", userId: "debtor", name: "Debtor" },
    ],
    settlements: [],
    expenses: [
      {
        id: "e",
        title: "Meal",
        payerId: "p",
        currency,
        createdAt: "",
        tax: 0,
        service: 0,
        tip: 0,
        discount: 0,
        items: [
          {
            title: "Food",
            quantity: 1,
            unitPrice: 2550,
            allocations: [{ memberId: "d", weight: 1 }],
          },
        ],
      },
    ],
  };
}
describe("dashboard display currencies", () => {
  it("maps all six languages and changes empty/zero-only accounts without mutating totals", () => {
    const expected = ["USD", "USD", "AMD", "EUR", "EUR", "AMD"];
    for (const [i, locale] of locales.entries()) {
      expect(getDefaultCurrencyForLanguage(locale)).toBe(expected[i]);
      expect(formatMoney(0,getDefaultCurrencyForLanguage(locale),locale,{currencySymbol:true})).toContain(["$","$","֏","€","€","֏"][i]);
      expect(getDashboardBalances([], locale)).toEqual([
        { currency: expected[i], owed: 0, receivable: 0 },
      ]);
      const history = [{ currency: "EUR" as const, owed: 0, receivable: 0 }];
      expect(getDashboardBalances(history, locale)[0].currency).toBe(
        expected[i],
      );
      expect(history[0].currency).toBe("EUR");
    }
    expect(formatMoney(0, "USD", "en", { currencySymbol: true })).toBe("$0.00");
    expect(formatMoney(0, "AMD", "hy", { currencySymbol: true })).toContain(
      "֏",
    );
  });
  it("keeps all active currencies, separate debt/receivables and exact values across every language", () => {
    const totals = [
      { currency: "AMD" as const, owed: 0, receivable: 0 },
      { currency: "USD" as const, owed: 5000, receivable: 0 },
      { currency: "EUR" as const, owed: 850, receivable: 850 },
      { currency: "AMD" as const, owed: 15000, receivable: 20 },
      { currency: "USDT" as const, owed: 0, receivable: 2500 },
    ];
    const before = JSON.stringify(totals);
    for (const locale of locales)
      expect(getDashboardBalances(totals, locale)).toEqual(totals.slice(1));
    expect(JSON.stringify(totals)).toBe(before);
  });
  it("uses exact outstanding amounts after partial/full confirmation, preserving historical records", () => {
    for (const currency of ["USD", "EUR", "AMD", "USDT"] as const) {
      const h = ledger(currency);
      const before = JSON.stringify(h);
      for (const locale of locales) {
        expect(
          getDashboardBalances(accountBalances([h], "debtor").totals, locale),
        ).toEqual([{ currency, owed: 2550, receivable: 0 }]);
        expect(
          getDashboardBalances(accountBalances([h], "payer").totals, locale),
        ).toEqual([{ currency, owed: 0, receivable: 2550 }]);
      }
      expect(JSON.stringify(h)).toBe(before);
      h.settlements = [
        {
          id: "s",
          fromId: "d",
          toId: "p",
          amount: 2549,
          status: "confirmed",
          method: "cash",
          createdAt: "",
        },
      ];
      expect(
        getDashboardBalances(accountBalances([h], "debtor").totals, "de"),
      ).toEqual([{ currency, owed: 1, receivable: 0 }]);
      h.settlements[0].amount = 2550;
      const settled = JSON.stringify(h);
      for (const locale of locales)
        expect(
          getDashboardBalances(
            accountBalances([h], "debtor").totals,
            locale,
          )[0],
        ).toEqual({
          currency: getDefaultCurrencyForLanguage(locale),
          owed: 0,
          receivable: 0,
        });
      expect(JSON.stringify(h)).toBe(settled);
      expect(h.expenses[0].currency).toBe(currency);
    }
  });
});
