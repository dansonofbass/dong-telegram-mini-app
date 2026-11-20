import { test, expect } from "@playwright/test";
const locales = ["en", "fa", "hy", "de", "fr", "ru"];
for (const width of [320, 768])
  test(`six languages at ${width}px in both themes`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    for (const locale of locales) {
      const selector = page.locator("header .language-picker select");
      await selector.selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        locale === "fa" ? "rtl" : "ltr",
      );
      await page.reload();
      await expect(selector).toHaveValue(locale);
      expect(
        await page.evaluate(() => localStorage.getItem("dong-language")),
      ).toBe(locale);
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          localStorage.setItem("dong-theme", value);
        }, theme);
        await page.reload();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if(width===320) expect(await page.locator(".bottom-nav a").evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth))).toBe(true);
        await selector.focus();
        await expect(selector).toBeFocused();
        await page.screenshot({
          path: `artifacts/i18n/${locale}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  });
test("detects Telegram language and preserves a manual override", async ({
  page,
}) => {
  await page.route("**/telegram-web-app.js", (route) => route.abort());
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        ready() {},
        expand() {},
        initDataUnsafe: { user: { language_code: "hy-AM" } },
      },
    };
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hy");
  await page.locator("header .language-picker select").selectOption("de");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});
test("detects browser language on a fresh visit", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await context.close();
});

test("native language selector supports keyboard changes and exposes exactly six choices", async ({
  page,
}) => {
  await page.goto("/");
  const selector = page.locator("header .language-picker select");
  await expect(selector.locator("option")).toHaveCount(6);
  await selector.focus();
  await selector.press("Home");
  await selector.press("ArrowDown");
  await selector.press("Enter");
  await expect(selector).toHaveValue("fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
