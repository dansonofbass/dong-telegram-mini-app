import { test, expect } from "@playwright/test";
for (const width of [320, 360, 375, 390, 414, 430, 768])
  test(`rendered mobile audit ${width}px English and Persian`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByLabel("Display name", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/mobile/${width}-onboarding.png`,
      fullPage: true,
    });
    await page.getByLabel("Display name", { exact: true }).fill("Mobile QA");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator(".hero")).toBeVisible();
    const result = await page.request.post("/api/demo/seed", { data: {} });
    expect(result.status()).toBe(200);
    const h = await result.json();
    const paths = [
      "/",
      "/create",
      "/invite/" + h.inviteToken,
      "/receiving",
      "/settings",
      "/activity",
      "/balances",
      ...["", "add", "members", "flow", "settle", "settings", "invite"].map(
        (p) => "/hangout/" + h.id + (p ? "/" + p : ""),
      ),
    ];
    for (const language of ["en", "fa"]) {
      if (language === "fa")
        await page
          .locator(".language-picker select").first().selectOption("fa");
      for (const [index, path] of paths.entries()) {
        await page.goto(path);
        await page.waitForTimeout(150);
        if (path === '/receiving') {
          await page.locator('.receiving-list > button').click();
          await expect(page.locator('form.panel')).toBeVisible();
        }
        if (path.endsWith('/add')) {
          await page.locator('.assignment-head button').first().click();
          await expect(page.locator('.weights')).toBeVisible();
          for (const adjustment of await page.locator('.typed-adjustment').all())
            await adjustment.locator('button').last().click();
        }
        await expect(page.locator('html')).toHaveAttribute('dir', language === 'fa' ? 'rtl' : 'ltr');
        await expect(page.locator("main")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${language} ${width} ${path}`,
        ).toBe(true);
        await page.screenshot({
          path: `artifacts/mobile/${width}-${language}-${index}.png`,
          fullPage: true,
        });
      }
    }
  });
