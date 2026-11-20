import { test, expect, type Page } from "@playwright/test";
async function register(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".hero")).toBeVisible();
  return (await page.request.get("/api/me")).json();
}
test("all previews and account flow include previous debts for the same users across saved hangouts", async ({
  page,
  browser,
}) => {
  const danial = await register(page, "Danial");
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const pooyan = await register(p, "Pooyan");
  const ctx2 = await browser.newContext();
  const n = await ctx2.newPage();
  const nima = await register(n, "Nima");
  async function group(
    title: string,
    peer: Page,
    peerId: string,
    amount: number,
    reverse = false,
  ) {
    let h = await (
      await page.request.post("/api/hangouts", {
        data: { title, date: "2026-11-20" },
      })
    ).json();
    await peer.request.post("/api/invites/" + h.inviteToken + "/join", {
      data: {},
    });
    h = await (await page.request.get("/api/hangouts/" + h.id)).json();
    const a = h.members.find((m: any) => m.userId === danial.id).id,
      b = h.members.find((m: any) => m.userId === peerId).id;
    const r = await page.request.post("/api/hangouts/" + h.id + "/expenses", {
      data: {
        title: "Bill",
        currency: "AMD",
        payerId: reverse ? b : a,
        items: [
          {
            title: "Food",
            quantity: 1,
            unitPrice: amount,
            allocations: [{ memberId: reverse ? a : b, weight: 1 }],
          },
        ],
        tax: 0,
        service: 0,
        tip: 0,
        discount: 0,
      },
    });
    expect(r.status()).toBe(200);
    return h;
  }
  const first = await group("Earlier dinner", p, pooyan.id, 3000);
  const second = await group("Today coffee", p, pooyan.id, 1300, true);
  await group("Trip with Nima", n, nima.id, 500);
  await page.goto("/");
  await expect(page.locator(".all-debt-preview .debt-lane")).toHaveCount(2);
  await expect(page.locator(".all-debt-preview")).toContainText("1,700 AMD");
  await expect(page.locator(".all-debt-preview")).toContainText("500 AMD");
  await expect(
    page.locator(".all-debt-preview .wide-connector .connection-path").first(),
  ).toHaveAttribute("d", "M2 14 L34 14");
  await page
    .locator(".all-debt-preview")
    .getByRole("link", { name: "Check the split" })
    .click();
  await expect(page).toHaveURL(/\/balances$/);
  await expect(page.locator(".account-graph .debt-lane")).toHaveCount(2);
  await page
    .locator(".account-graph .debt-lane")
    .filter({ hasText: "Pooyan" })
    .click();
  await expect(page.locator(".account-breakdown")).toContainText(
    "Earlier dinner",
  );
  await expect(page.locator(".account-breakdown")).toContainText(
    "Today coffee",
  );
  await expect(page.locator(".pair-total")).toContainText("1,700 AMD");
  await page.screenshot({
    path: "artifacts/account-balances-desktop.png",
    fullPage: true,
  });
  await page.goto("/hangout/" + second.id + "/flow");
  await expect(page.locator(".carryover-panel")).toContainText("1,700 AMD");
  await expect(page.locator(".group-debt-graph")).toContainText("1,300 AMD");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/carryover-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".carryover-panel")).toContainText("1,700 AMD");
  await p.goto("/balances");
  await expect(p.locator(".account-graph .debt-lane")).toHaveCount(1);
  await expect(p.locator(".account-graph")).not.toContainText("Nima");
  await ctx.close();
  await ctx2.close();
});
test("Persian receiving method saves, edits and reports a precise inline validation error", async ({
  page,
}) => {
  await register(page, "Persian user");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.goto("/receiving");
  await page
    .getByRole("button", { name: "افزودن روش دریافت", exact: true })
    .click();
  await page.getByLabel("اطلاعات دریافت", { exact: true }).fill("۱۲۳");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("۱۲ تا ۱۹");
  await page
    .getByLabel("اطلاعات دریافت", { exact: true })
    .fill("۶۲۱۹ ۸۶۱۹ ۱۲۳۴ ۵۶۷۸");
  await page.getByLabel("انتخاب به‌عنوان پیش‌فرض", { exact: true }).check();
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.locator(".receiving-list")).toContainText("5678");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "ویرایش روش دریافت", exact: true })
    .click();
  await page
    .getByLabel("اطلاعات دریافت", { exact: true })
    .fill("٦٢١٩-٨٦١٩-١٢٣٤-٥٦٧٨");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await page
    .getByRole("button", { name: "مشاهده جزئیات", exact: true })
    .click();
  await expect(page.locator(".full-value")).toHaveText("6219861912345678");
  await page.reload();
  await expect(page.locator(".receiving-list")).toContainText("5678");
  await page.screenshot({
    path: "artifacts/receiving-fa-fixed.png",
    fullPage: true,
  });
});
test("public interactive demo walks through different creators, live shares and creditor-confirmed payment without real writes", async ({
  page,
}) => {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("/api/")) writes.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("link", { name: "Try the interactive demo", exact: true })
    .click();
  await expect(page.locator(".demo-guide")).toBeVisible();
  await page.getByLabel("Hangout name", { exact: true }).fill("Demo journey");
  await page
    .getByRole("button", { name: "Create hangout", exact: true })
    .click();
  const next = () =>
    page.getByRole("button", { name: "Next step", exact: true }).click();
  await next();
  await page.getByRole("button", { name: "Sara joins", exact: true }).click();
  await page.getByRole("button", { name: "Reza joins", exact: true }).click();
  await next();
  await expect(page.locator(".demo-live-shares")).toContainText("11,000 AMD");
  await page.getByLabel("Try a 10% dinner discount").check();
  await page.getByLabel("Try a 5% service charge").check();
  await expect(page.locator(".demo-live-shares")).toContainText("10,395 AMD");
  await page.getByRole("button", { name: "Add this expense" }).click();
  await next();
  await expect(page.locator(".demo-actor")).toContainText("Sara");
  await page.getByRole("button", { name: "Add this expense" }).click();
  await next();
  await expect(page.locator(".demo-actor")).toContainText("Reza");
  await page.getByRole("button", { name: "Add this expense" }).click();
  await next();
  await expect(page.locator(".demo-ledger")).toContainText("14,595 AMD");
  await page.screenshot({
    path: "artifacts/demo-multiple-creators.png",
    fullPage: true,
  });
  await next();
  await expect(page.locator(".demo-debts .debt-lane")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/demo-flow-mobile.png",
    fullPage: true,
  });
  await next();
  const before = await page.locator(".demo-debts").innerText();
  await page.getByRole("button", { name: /Mark as paid ·/ }).click();
  expect(await page.locator(".demo-debts").innerText()).toBe(before);
  await page.getByRole("button", { name: /Confirm receipt ·/ }).click();
  await expect(page.locator(".demo-workspace")).toContainText(
    "Receipt confirmed.",
  );
  expect(await page.locator(".demo-debts").innerText()).not.toBe(before);
  await next();
  await expect(page.locator(".demo-events")).toContainText("Ali");
  await expect(page.locator(".demo-events")).toContainText("Sara");
  await expect(page.locator(".demo-events")).toContainText("Reza");
  await page.reload();
  await expect(page.locator(".demo-step-heading")).toContainText(
    "Keep the history",
  );
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  expect((await page.request.get("/api/me")).status()).toBe(401);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/demo-history-mobile.png",
    fullPage: true,
  });
  await page.getByRole('button',{name:'Language',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('.demo-step-heading')).toContainText('تاریخچه را نگه دارید');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/demo-fa-mobile.png',fullPage:true});
});
