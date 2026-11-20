import { it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../server/db";
import { calculate, type Hangout } from "../shared/engine";
it("migrates the original v1 schema forward without losing records, invitations or confirmed payments", () => {
  const dir = mkdtempSync(join(tmpdir(), "dong-migrate-"));
  const path = join(dir, "v1.sqlite");
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  db.exec(readFileSync(new URL("./fixtures/v1.sql", import.meta.url), "utf8"));
  const h: Hangout = {
    id: "old-h",
    ownerId: "tg-42",
    title: "Preserved dinner",
    description: "Keep this",
    currency: "AMD",
    date: "2026-11-20",
    icon: "dinner",
    members: [
      { id: "a", name: "Ali", userId: "tg-42" },
      { id: "b", name: "Sara", userId: "tg-43" },
    ],
    expenses: [
      {
        id: "old-e",
        title: "Dinner",
        payerId: "a",
        currency: "AMD",
        items: [
          {
            title: "Meal",
            quantity: 1,
            unitPrice: 10000,
            allocations: [
              { memberId: "a", weight: 1 },
              { memberId: "b", weight: 1 },
            ],
          },
        ],
        tax: 1000,
        tip: 100,
        service: 0,
        discount: 0,
        createdAt: "2026-11-19T00:00:00Z",
      },
    ],
    settlements: [
      {
        id: "old-s",
        fromId: "b",
        toId: "a",
        amount: 1000,
        status: "confirmed",
        method: "cash",
        createdAt: "2026-11-19T01:00:00Z",
      },
    ],
    inviteToken: "keep-token",
    preferences: { a: { method: "card", details: "1234567890123456" } },
  };
  db.prepare("INSERT INTO users(id,name) VALUES(?,?)").run("tg-42", "Ali");
  db.prepare("INSERT INTO users(id,name) VALUES(?,?)").run("tg-43", "Sara");
  db.prepare(
    "INSERT INTO hangouts(id,owner_id,title,currency,document) VALUES(?,?,?,?,?)",
  ).run(h.id, h.ownerId, h.title, h.currency, JSON.stringify(h));
  for (const m of h.members)
    db.prepare("INSERT INTO members VALUES(?,?,?,?)").run(
      m.id,
      h.id,
      m.userId,
      m.name,
    );
  db.prepare("INSERT INTO expenses VALUES(?,?,?,?)").run(
    "old-e",
    h.id,
    "a",
    "Dinner",
  );
  db.prepare("INSERT INTO invitations(token,hangout_id) VALUES(?,?)").run(
    h.inviteToken,
    h.id,
  );
  db.prepare(
    "INSERT INTO settlements(id,hangout_id,from_id,to_id,amount,status,method) VALUES(?,?,?,?,?,?,?)",
  ).run("old-s", h.id, "b", "a", 1000, "confirmed", "cash");
  db.close();
  try {
    const store = openDatabase(path);
    const migrated = store.load(h.id)!;
    expect(migrated.expenses[0].createdByUserId).toBe(h.ownerId);
    expect(migrated.expenses[0].tax).toBe(1000);
    expect(migrated.settlements).toEqual(h.settlements);
    expect(calculate(migrated)).toEqual(calculate(h));
    expect(
      store.db
        .prepare("SELECT token FROM invitations WHERE token=?")
        .get("keep-token"),
    ).toBeTruthy();
    expect(
      (
        store.db
          .prepare("SELECT telegram_id FROM users WHERE id=?")
          .get("tg-42") as any
      ).telegram_id,
    ).toBe("42");
    expect(
      (
        store.db
          .prepare("SELECT value FROM receiving_methods WHERE user_id=?")
          .get("tg-42") as any
      ).value,
    ).toBe(h.preferences.a.details);
    expect(
      (store.db.prepare("SELECT count(*) n FROM migrations").get() as any).n,
    ).toBe(4);
    const snapshotName = readdirSync(dir).find(name => name.includes('.before-cad-'))!;
    expect(snapshotName).toBeTruthy();
    const snapshot = new DatabaseSync(join(dir,snapshotName));
    try {
      expect(snapshot.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
      expect(snapshot.prepare('SELECT max(version) AS v FROM migrations').get()?.v).toBe(3);
      expect(snapshot.prepare('SELECT document FROM hangouts WHERE id=?').get(h.id)?.document).toBe(JSON.stringify(migrated));
    } finally { snapshot.close(); }
    store.save(migrated);
    expect(store.load(h.id)!.settlements[0].status).toBe("confirmed");
    store.db.close();
    const reopened = openDatabase(path);
    expect(
      (
        reopened.db
          .prepare("SELECT count(*) n FROM receiving_methods")
          .get() as any
      ).n,
    ).toBe(1);
    reopened.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
