import { test, expect } from "@playwright/test";
test("CAD creation, shared item cents and locale switching preserve the ledger", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByLabel("Display name", { exact: true }).fill("Euro tester");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.goto("/create");
  await page.getByLabel("Hangout name").fill("Euro dinner");
  await expect(page.locator('option[value="CAD"]')).toHaveText("CAD (CA$)");
  await page
    .getByRole("combobox", { name: "Currency", exact: true })
    .selectOption("CAD");
  await page
    .getByRole("button", { name: "Create hangout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/hangout\/[^/]+$/);
  const path = new URL(page.url()).pathname;
  const apiPath = path.replace("/hangout/", "/api/hangouts/");
  const invitation = (await (await page.request.get(apiPath)).json())
    .inviteToken;
  for (const name of ["Friend B", "Friend C"]) {
    const context = await browser.newContext();
    try {
      expect(
        (
          await context.request.post("/api/auth/guest", { data: { name } })
        ).status(),
      ).toBe(200);
      expect(
        (
          await context.request.post("/api/invites/" + invitation + "/join", {
            data: {},
          })
        ).status(),
      ).toBe(200);
    } finally {
      await context.close();
    }
  }
  await page.goto(path + "/add");
  await page.getByLabel("Expense name").fill("Shared meal");
  await page.getByLabel("Item name").fill("Dinner");
  await page.getByLabel("Unit price").fill("25.50");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(path + "$"));
  const initial = await (await page.request.get(apiPath)).json();
  expect(initial.currency).toBe("CAD");
  expect(initial.expenses[0].items[0].unitPrice).toBe(2550);
  expect(initial.expenses[0].items[0].allocations).toHaveLength(3);
  for (const locale of ["en", "fa", "hy", "de", "fr", "ru"]) {
    await page.locator("header .language-picker select").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      locale === "fa" ? "rtl" : "ltr",
    );
    await expect(page.locator("main")).toContainText("CAD");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const current = await (await page.request.get(apiPath)).json();
    expect(current).toEqual(initial);
    await page.screenshot({
      path: `artifacts/cad/${locale}-320.png`,
      fullPage: true,
    });
  }
});
