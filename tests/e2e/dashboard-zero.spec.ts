import { test, expect } from "@playwright/test";
import { getDefaultCurrencyForLanguage } from "../../src/dashboard-balances";
import { formatMoney } from "../../src/money";
import { locales } from "../../src/i18n";
test("home updates empty and settled defaults immediately while active EUR stays EUR", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByLabel("Display name", { exact: true }).fill("Zero balance");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".summary-grid")).toBeVisible();
  async function checkZero() {
    for (const locale of locales) {
      await page.locator("header .language-picker select").selectOption(locale);
      const expected = formatMoney(
        0,
        getDefaultCurrencyForLanguage(locale),
        locale,
        { currencySymbol: true },
      );
      const values = await page
        .locator(".summary-grid .summary-card > strong")
        .allTextContents();
      expect(values).toEqual([expected, expected, expected]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await checkZero();
  const guest = await browser.newContext();
  try {
    expect(
      (
        await guest.request.post("/api/auth/guest", { data: { name: "Peer" } })
      ).status(),
    ).toBe(200);
    const h = await (
      await page.request.post("/api/hangouts", {
        data: { title: "Euro bill", currency: "EUR", date: "2026-11-21" },
      })
    ).json();
    const joined = await (
      await guest.request.post("/api/invites/" + h.inviteToken + "/join", {
        data: {},
      })
    ).json();
    const base = "/api/hangouts/" + h.id;
    const payer = h.members[0].id;
    const debtor = joined.members[1].id;
    const expense = await page.request.post(base + "/expenses", {
      data: {
        title: "Meal",
        payerId: payer,
        currency: "EUR",
        items: [
          {
            title: "Meal",
            quantity: 1,
            unitPrice: 2550,
            allocations: [{ memberId: debtor, weight: 1 }],
          },
        ],
        tax: 0,
        tip: 0,
        service: 0,
        discount: 0,
      },
    });
    expect(expense.status()).toBe(200);
    await page.reload();
    await expect(page.locator(".summary-grid")).toBeVisible();
    const snapshot = await (await page.request.get(base)).json();
    for (const locale of locales) {
      await page.locator("header .language-picker select").selectOption(locale);
      expect(
        await page
          .locator(".summary-grid .summary-card > strong")
          .allTextContents(),
      ).toEqual([
        formatMoney(0, "EUR", locale),
        formatMoney(2550, "EUR", locale),
        formatMoney(2550, "EUR", locale),
      ]);
      expect(await (await page.request.get(base)).json()).toEqual(snapshot);
    }
    for (const amount of [1000, 1550]) {
      const marked = await guest.request.post(base + "/settlements", {
        data: { fromId: debtor, toId: payer, amount, method: "cash" },
      });
      expect(marked.status()).toBe(200);
      const settlement = (await marked.json()).settlements.at(-1);
      expect(
        (
          await page.request.post(
            base + "/settlements/" + settlement.id + "/confirm",
            { data: {} },
          )
        ).status(),
      ).toBe(200);
      await page.reload();
      await expect(page.locator(".summary-grid")).toBeVisible();
      if (amount === 1000)
        expect(
          await page
            .locator(".summary-grid .summary-card > strong")
            .nth(1)
            .textContent(),
        ).toBe(formatMoney(1550, "EUR", "ru"));
    }
    await checkZero();
    const history = await (await page.request.get(base)).json();
    expect(history.currency).toBe("EUR");
    expect(history.expenses[0].items[0].unitPrice).toBe(2550);
    expect(
      history.settlements.map((s: { amount: number }) => s.amount),
    ).toEqual([1000, 1550]);
  } finally {
    await guest.close();
  }
});
