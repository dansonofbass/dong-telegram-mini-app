import { test, expect } from "@playwright/test";
test("create, add members, itemized shared expense, edit, persist, invite, settle, RTL and themes", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Split the moment." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create hangout", exact: true })
    .first()
    .click();
  await page.getByLabel("Hangout name").fill("E2E dinner " + Date.now());
  await page
    .getByRole("button", { name: "Create hangout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
  const url = page.url();
  await page.getByRole("link", { name: "Members", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Mina");
  await page.getByRole("button", { name: "Add participant" }).click();
  await expect(page.getByText("Mina", { exact: true })).toBeVisible();
  await page.goto(url + "/invite");
  await expect(page.locator(".invite-url")).toContainText("/join/");
  const invite = await page.locator(".invite-url").innerText();
  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await guest.goto("/");
  await guest.evaluate(() => localStorage.setItem("dong-user", "sara"));
  await guest.goto(invite);
  await guest.getByRole("button", { name: "Join hangout" }).click();
  await expect(
    guest.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
  await page.goto(url + "/add");
  await page.getByLabel("Expense name").fill("Shared dinner");
  await page.getByLabel("Item name").fill("Pizza");
  await page.getByLabel("Unit price").fill("9000");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(
    page.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Shared dinner", { exact: true })).toBeVisible();
  await page.getByText("Shared dinner", { exact: true }).click();
  await page.getByRole("link", { name: "Edit expense", exact: true }).click();
  await page.getByLabel("Unit price").fill("12000");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true })).toBeVisible();
  await page.goto(url + "/split");
  await expect(page.locator(".balance-table")).toContainText("4,000 AMD");
  await page.goto(url + "/flow");
  await expect(page.locator(".debt-connection")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".debt-canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/debt-mobile.png", fullPage: true });
  await guest.goto(url + "/settle");
  await guest.getByLabel("Amount (AMD)").fill("1000");
  await guest.getByRole("button", { name: "Mark as paid" }).click();
  await expect(guest.locator(".status-badge")).toHaveText("Marked as paid");
  await page.goto(url + "/settle");
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(page.locator(".status-badge")).toHaveText("Confirmed");
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("combobox", { name: "ظاهر", exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(11, 17, 39)");
  await expect(page.locator("h1")).toHaveCSS("color", "rgb(238, 234, 248)");
  await page.screenshot({ path: "artifacts/settings-fa.png", fullPage: true });
  await ctx.close();
});
test("home desktop and mobile visual checks", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  await expect(page.locator(".hangout-card").first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/home-fa-mobile.png",
    fullPage: true,
  });
});
