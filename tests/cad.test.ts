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
it("creates a CAD ledger, splits 2550 cents three ways, and confirms an 850-cent settlement", async () => {
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
      payload: { title: "Euro dinner", currency: "CAD", date: "2026-11-21" },
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
        currency: "CAD",
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
    expect(h.currency).toBe("CAD");
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

it("CAD uses cents, and remote version 3 migration preserves dependent data and is repeatable", async () => {
  const { remoteDatabase } = await import("../server/storage");
  const { migrateEmptyDatabase } = await import("../server/migrations");
  const { readFileSync } = await import("node:fs");
  const db = remoteDatabase("file::memory:");
  try {
    expect(minor("25.50", "CAD")).toBe(2550);
    expect(precision("CAD")).toBe(2);
    expect(() => minor("25.501", "CAD")).toThrow();
    for (const locale of locales)
      expect(formatMoney(2550, "CAD", locale)).toContain("CAD");
    const schema = readFileSync(
      new URL("../server/schema.sql", import.meta.url),
      "utf8",
    );
    await db.exec(
      schema
        .replace(",'CAD'", "")
        .replace("VALUES(1),(2),(3),(4)", "VALUES(1),(2),(3)"),
    );
    await db.prepare("INSERT INTO users(id,name) VALUES('u','User')").run();
    await db
      .prepare(
        "INSERT INTO hangouts(id,owner_id,title,currency,document) VALUES('h','u','Old','USD','{}')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO members(id,hangout_id,user_id,name) VALUES('m','h','u','User')",
      )
      .run();
    await db
      .prepare("INSERT INTO invitations(token,hangout_id) VALUES('invite','h')")
      .run();
    await db
      .prepare(
        "INSERT INTO expenses(id,hangout_id,payer_id,title) VALUES('e','h','m','Meal')",
      )
      .run();
    await migrateEmptyDatabase(db, schema);
    await migrateEmptyDatabase(db, schema);
    expect(
      (await db.prepare("SELECT currency FROM hangouts WHERE id='h'").get())
        ?.currency,
    ).toBe("USD");
    for (const table of ["members", "invitations", "expenses"])
      expect(
        (await db.prepare("SELECT count(*) AS n FROM " + table).get())?.n,
      ).toBe(1);
    await db
      .prepare(
        "INSERT INTO hangouts(id,owner_id,title,currency,document) VALUES('cad','u','CAD','CAD','{}')",
      )
      .run();
    expect(
      (await db.prepare("SELECT max(version) AS v FROM migrations").get())?.v,
    ).toBe(4);
    expect(await db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    db.close();
  }
});
