import { it, expect } from "vitest";
import { createApp } from "../server/app";
import {
  minor,
  precision,
  expenseShares,
  calculate,
  type Hangout,
} from "../shared/engine";
import { formatMoney } from "../src/money";
import { locales, localeTag } from "../src/i18n";
it("formats EUR to exactly two decimals in all six locales and preserves other currencies", () => {
  expect(precision("EUR")).toBe(2);
  expect(minor("25.50", "EUR")).toBe(2550);
  expect(() => minor("25.501", "EUR")).toThrow();
  for (const locale of locales) {
    const formatter = new Intl.NumberFormat(localeTag(locale), {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(formatMoney(2550, "EUR", locale)).toBe(formatter.format(25.5));
    expect(
      formatter.formatToParts(25.5).find((p) => p.type === "fraction")?.value,
    ).toHaveLength(2);
    expect(formatMoney(850, "EUR", locale)).toContain("€");
  }
  expect(formatMoney(3500, "AMD", "en")).toBe("3,500 AMD");
  expect(formatMoney(2550, "USD", "en")).toBe("25.50 USD");
  expect(formatMoney(2550, "USDT", "en")).toBe("25.50 USDT");
});
it("creates a EUR ledger, splits 2550 cents three ways, and confirms an 850-cent settlement", async () => {
  const app = await createApp({ database: ":memory:", demo: true });
  try {
    const users = [];
    for (const name of ["Payer", "Friend B", "Friend C"]) {
      const result = await app.inject({
        method: "POST",
        url: "/api/auth/guest",
        payload: { name },
      });
      users.push({
        cookie: String(result.headers["set-cookie"]).split(";")[0],
      });
    }
    const created = await app.inject({
      method: "POST",
      url: "/api/hangouts",
      headers: users[0],
      payload: { title: "Euro dinner", currency: "EUR", date: "2026-11-21" },
    });
    expect(created.statusCode).toBe(200);
    let h = created.json<Hangout>();
    const base = "/api/hangouts/" + h.id;
    for (const headers of users.slice(1)) {
      const result = await app.inject({
        method: "POST",
        url: "/api/invites/" + h.inviteToken + "/join",
        headers,
        payload: {},
      });
      expect(result.statusCode).toBe(200);
      h = result.json();
    }
    const result = await app.inject({
      method: "POST",
      url: base + "/expenses",
      headers: users[0],
      payload: {
        title: "Shared meal",
        payerId: h.members[0].id,
        currency: "EUR",
        items: [
          {
            title: "Meal",
            quantity: 1,
            unitPrice: 2550,
            allocations: h.members.map((m) => ({ memberId: m.id, weight: 1 })),
          },
        ],
        tax: 0,
        tip: 0,
        service: 0,
        discount: 0,
      },
    });
    expect(result.statusCode).toBe(200);
    h = result.json();
    expect(Object.values(expenseShares(h.expenses[0]).shares)).toEqual([
      850, 850, 850,
    ]);
    expect(calculate(h).transfers).toHaveLength(2);
    expect(calculate(h).transfers.every((t) => t.amount === 850)).toBe(true);
    const marked = await app.inject({
      method: "POST",
      url: base + "/settlements",
      headers: users[1],
      payload: {
        fromId: h.members[1].id,
        toId: h.members[0].id,
        amount: 850,
        method: "cash",
      },
    });
    expect(marked.statusCode).toBe(200);
    h = marked.json();
    const sid = h.settlements[0].id;
    const confirmed = await app.inject({
      method: "POST",
      url: base + "/settlements/" + sid + "/confirm",
      headers: users[0],
      payload: {},
    });
    expect(confirmed.statusCode).toBe(200);
    h = confirmed.json();
    expect(h.currency).toBe("EUR");
    expect(h.settlements[0]).toMatchObject({
      amount: 850,
      status: "confirmed",
    });
    expect(calculate(h).transfers).toHaveLength(1);
    expect(calculate(h).transfers[0].amount).toBe(850);
    const before = JSON.stringify(h);
    for (const locale of locales)
      formatMoney(h.expenses[0].items[0].unitPrice, h.currency, locale);
    expect(JSON.stringify(h)).toBe(before);
  } finally {
    await app.close();
  }
});
