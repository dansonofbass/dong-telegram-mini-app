import { test, expect, type Page } from "@playwright/test";
async function onboard(page: Page, name: string) {
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function addExpense(
  page: Page,
  url: string,
  title: string,
  price: string,
) {
  await page.goto(url + "/add");
  await page.getByLabel("Expense name").fill(title);
  await page.getByLabel("Item name").fill("Meal");
  await page.getByLabel("Unit price").fill(price);
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(
    page.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
}
test("two independent users onboard through an invitation, share data, enforce ownership, settle and persist", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await onboard(page, "Ali");
  await expect(page.locator(".hero")).toBeVisible();
  const ali = await (await page.request.get("/api/me")).json();
  await page
    .getByRole("button", { name: "Create hangout", exact: true })
    .first()
    .click();
  await page.getByLabel("Hangout name").fill("Friday Dinner " + Date.now());
  await page
    .getByRole("button", { name: "Create hangout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
  const url = page.url();
  const hid = url.split("/").at(-1)!;
  await addExpense(page, url, "Ali dinner", "1000");
  const old = (await (await page.request.get("/api/hangouts/" + hid)).json())
    .expenses[0];
  await page.goto(url + "/invite");
  await expect(page.locator(".invite-url")).toContainText("/invite/");
  const invitation = await page.locator(".invite-url").innerText();
  const ctx = await browser.newContext();
  const saraPage = await ctx.newPage();
  await saraPage.goto(invitation);
  await expect(
    saraPage.getByLabel("Display name", { exact: true }),
  ).toBeVisible();
  await saraPage.reload();
  await expect(saraPage).toHaveURL(invitation);
  await onboard(saraPage, "Sara");
  await expect(saraPage).toHaveURL(url);
  await expect(saraPage.getByText("Ali dinner", { exact: true })).toBeVisible();
  const sara = await (await saraPage.request.get("/api/me")).json();
  expect(sara.id).not.toBe(ali.id);
  await page.goto(url + "/members");
  await expect(
    page.locator(".member-row").filter({ hasText: "Sara" }),
  ).toBeVisible();
  await page.goto(url);
  await addExpense(saraPage, url, "Sara shared dinner", "6000");
  await expect(
    page.getByText("Sara shared dinner", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await saraPage.getByText("Sara shared dinner", { exact: true }).click();
  await saraPage
    .getByRole("link", { name: "Edit expense", exact: true })
    .click();
  await saraPage.getByLabel("Unit price").fill("9000");
  await saraPage.getByLabel("Who paid?").selectOption({ label: "Ali" });
  await saraPage.getByRole("button", { name: "Save expense" }).click();
  await expect(
    saraPage.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
  await saraPage.goto(url + "/expense/" + old.id);
  await expect(
    saraPage.getByRole("link", { name: "Edit expense", exact: true }),
  ).toHaveCount(0);
  const denied = await saraPage.request.put(
    "/api/hangouts/" + hid + "/expenses/" + old.id,
    { data: { ...old, expectedRevision: old.revision } },
  );
  expect(denied.status()).toBe(403);
  await page.goto("/receiving");
  await page.getByRole("button", { name: "Add receiving method" }).click();
  await page
    .getByRole("combobox", { name: "Method", exact: true })
    .selectOption("card");
  await page
    .getByLabel("Receiving value", { exact: true })
    .fill("1234 5678 9012 3456");
  await page.getByLabel("Make preferred").check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".receiving-list")).toContainText("3456");
  await expect(page.locator(".receiving-list")).not.toContainText("1234 5678");
  await saraPage.goto(url + "/flow");
  await expect(saraPage.locator(".debt-lane")).toHaveCount(1);
  const h = await (await saraPage.request.get("/api/hangouts/" + hid)).json();
  const transfer = h.members.find((m: any) => m.userId === sara.id);
  await expect(saraPage.locator(".debt-lane")).toHaveAttribute(
    "data-from",
    transfer.id,
  );
  await expect(saraPage.locator(".debt-lane")).toContainText("4,500 AMD");
  const path = await saraPage
    .locator(".wide-connector .connection-path")
    .getAttribute("d");
  expect(path).toContain("L");
  expect(
    await saraPage
      .locator(".wide-connector .connection-path")
      .getAttribute("marker-end"),
  ).toContain("url(#");
  await saraPage.locator(".debt-lane").click();
  await expect(saraPage.locator(".graph-selection")).toContainText("Sara");
  await saraPage.screenshot({
    path: "artifacts/v12-debt-desktop.png",
    fullPage: true,
  });
  await saraPage.setViewportSize({ width: 390, height: 844 });
  expect(
    await saraPage
      .locator(".wide-connector .connection-path")
      .getAttribute("d"),
  ).toBe(path);
  await expect(saraPage.locator(".narrow-connector")).toBeVisible();
  expect(
    await saraPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await saraPage.emulateMedia({ reducedMotion: "reduce" });
  await expect(saraPage.locator(".connection-path").last()).toHaveCSS(
    "animation-name",
    "none",
  );
  await saraPage.screenshot({
    path: "artifacts/v12-debt-mobile.png",
    fullPage: true,
  });
  await saraPage.goto(url + "/settle");
  await expect(
    saraPage.getByRole("combobox", { name: "Method", exact: true }),
  ).toContainText("3456");
  await saraPage
    .getByRole("button", { name: "Open details", exact: true })
    .click();
  await expect(saraPage.locator(".receiving-details")).toContainText(
    "1234 5678 9012 3456",
  );
  await saraPage.getByLabel("Amount (AMD)").fill("1000");
  await saraPage.getByRole("button", { name: "Mark as paid" }).click();
  await expect(saraPage.locator(".status-badge")).toHaveText("Marked as paid");
  await page.goto(url + "/settle");
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(page.locator(".status-badge")).toHaveText("Confirmed");
  await saraPage.goto(url + "/flow");
  await expect(saraPage.locator(".debt-lane")).toContainText("3,500 AMD");
  await page.goto(url + "/activity");
  await expect(page.locator(".timeline")).toContainText("Sara");
  await expect(page.locator(".timeline")).toContainText("confirmed receipt");
  await page.screenshot({ path: "artifacts/v12-activity.png", fullPage: true });
  await page.reload();
  await saraPage.reload();
  expect((await (await page.request.get("/api/me")).json()).id).toBe(ali.id);
  expect((await (await saraPage.request.get("/api/me")).json()).id).toBe(
    sara.id,
  );
  await expect(saraPage.locator(".debt-lane")).toContainText("3,500 AMD");
  expect(errors).toEqual([]);
  await ctx.close();
});
test("sample is explicit; percentage controls, Persian RTL and dark theme remain functional", async ({
  page,
}) => {
  await page.goto("/");
  await onboard(page, "Visual guest");
  await expect(page.locator(".hangout-card")).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Explore a sample dinner" }).click();
  await expect(
    page.getByRole("heading", { name: "Friday dinner", exact: true }),
  ).toBeVisible();
  const url = page.url();
  await page.goto("/");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "artifacts/v12-home-desktop.png",
    fullPage: true,
  });
  await page.goto(url + "/add");
  await page.getByLabel("Expense name").fill("Percentage example");
  await page.getByLabel("Item name").fill("Food");
  await page.getByLabel("Unit price").fill("20000");
  await page
    .getByRole("button", { name: "Discount Percentage", exact: true })
    .click();
  await page.getByLabel("Discount", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Service fee Percentage", exact: true })
    .click();
  await page.getByLabel("Service fee", { exact: true }).fill("5");
  await page.getByLabel("Tax", { exact: true }).fill("1000");
  await expect(page.locator(".bill-total")).toContainText("19,900 AMD");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(
    page.getByRole("heading", { name: "Expenses", exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("fa");
  await page
    .getByRole("combobox", { name: "ظاهر", exact: true })
    .selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(11, 17, 39)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/v12-settings-fa.png",
    fullPage: true,
  });
  await page.goto(url + "/flow");
  await expect(page.locator(".debt-lane").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/v12-flow-fa.png", fullPage: true });
  await page.goto(url + "/activity");
  await expect(page.locator(".timeline")).toBeVisible();
  await page.screenshot({
    path: "artifacts/v12-activity-fa.png",
    fullPage: true,
  });
});

test("crowded mobile debts use a readable compact list with visible directional arrows", async ({
  page,
}) => {
  await page.goto("/");
  await onboard(page, "Crowded sample");
  await expect(page.locator(".hero")).toBeVisible();
  let h = await (
    await page.request.post("/api/demo/seed", { data: {} })
  ).json();
  for (let i = 0; i < 5; i++) {
    const r = await page.request.post("/api/hangouts/" + h.id + "/members", {
      data: { name: "Friend " + (i + 1) },
    });
    expect(r.status()).toBe(200);
    h = await r.json();
  }
  const r = await page.request.post("/api/hangouts/" + h.id + "/expenses", {
    data: {
      title: "Shared trip",
      payerId: h.members[0].id,
      currency: "AMD",
      items: [
        {
          title: "Tickets",
          quantity: 1,
          unitPrice: 90000,
          allocations: h.members.map((m: any) => ({
            memberId: m.id,
            weight: 1,
          })),
        },
      ],
      tax: 0,
      service: 0,
      tip: 0,
      discount: 0,
    },
  });
  expect(r.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hangout/" + h.id + "/flow");
  await expect(page.locator(".debt-lanes.crowded")).toBeVisible();
  await expect(page.locator(".debt-lane")).toHaveCount(8);
  await expect(page.locator(".compact-connector").first()).toBeVisible();
  const geometry=await page.locator('.debt-lane').evaluateAll(nodes=>nodes.map(n=>{const label=n.querySelector('.flow-connector>bdi')!.getBoundingClientRect();const cards=[...n.querySelectorAll('.flow-node')].map(c=>c.getBoundingClientRect().top);return {labelBottom:label.bottom,cardTop:Math.min(...cards)};}));
  for(const row of geometry)expect(row.labelBottom).toBeLessThanOrEqual(row.cardTop);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const boxes = await page.locator(".debt-lane").evaluateAll((nodes) =>
    nodes.map((n) => {
      const b = n.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom };
    }),
  );
  for (let i = 1; i < boxes.length; i++)
    expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].bottom);
  await page.screenshot({
    path: "artifacts/v12-crowded-mobile.png",
    fullPage: true,
  });
});
