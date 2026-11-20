import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Hangout } from "../shared/engine";
export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  );
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=1").get())
    db.exec(`BEGIN;
 CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE hangouts(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN ('AMD','USD','EUR','USDT')),document TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE members(id TEXT PRIMARY KEY,hangout_id TEXT NOT NULL REFERENCES hangouts(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id),name TEXT NOT NULL,UNIQUE(hangout_id,user_id));
 CREATE INDEX members_user ON members(user_id,hangout_id);
 CREATE TABLE invitations(token TEXT PRIMARY KEY,hangout_id TEXT NOT NULL REFERENCES hangouts(id) ON DELETE CASCADE,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE expenses(id TEXT PRIMARY KEY,hangout_id TEXT NOT NULL REFERENCES hangouts(id) ON DELETE CASCADE,payer_id TEXT NOT NULL REFERENCES members(id),title TEXT NOT NULL);
 CREATE TABLE expense_items(id TEXT PRIMARY KEY,expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,title TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),unit_price INTEGER NOT NULL CHECK(unit_price>=0));
 CREATE TABLE item_allocations(item_id TEXT NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES members(id),weight INTEGER NOT NULL CHECK(weight>0),PRIMARY KEY(item_id,member_id));
 CREATE TABLE expense_adjustments(expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,kind TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>=0),PRIMARY KEY(expense_id,kind));
 CREATE TABLE settlements(id TEXT PRIMARY KEY,hangout_id TEXT NOT NULL REFERENCES hangouts(id) ON DELETE CASCADE,from_id TEXT NOT NULL REFERENCES members(id),to_id TEXT NOT NULL REFERENCES members(id),amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL CHECK(status IN ('pending','marked','confirmed')),method TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE settlement_preferences(member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,method TEXT NOT NULL,details TEXT NOT NULL);
 CREATE TABLE submissions(user_id TEXT NOT NULL,key TEXT NOT NULL,response TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,key));
 INSERT INTO migrations(version) VALUES(1); COMMIT;`);
  const load = (id: string) => {
    const row = db
      .prepare("SELECT document FROM hangouts WHERE id=?")
      .get(id) as { document: string } | undefined;
    return row ? (JSON.parse(row.document) as Hangout) : undefined;
  };
  function save(h: Hangout) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "INSERT INTO hangouts(id,owner_id,title,currency,document) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,document=excluded.document,updated_at=CURRENT_TIMESTAMP",
      ).run(h.id, h.ownerId, h.title, h.currency, JSON.stringify(h));
      for (const m of h.members)
        db.prepare(
          "INSERT INTO members(id,hangout_id,user_id,name) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
        ).run(m.id, h.id, m.userId, m.name);
      db.prepare("DELETE FROM settlements WHERE hangout_id=?").run(h.id);
      db.prepare("DELETE FROM expenses WHERE hangout_id=?").run(h.id);
      for (const e of h.expenses) {
        db.prepare("INSERT INTO expenses VALUES(?,?,?,?)").run(
          e.id,
          h.id,
          e.payerId,
          e.title,
        );
        for (const item of e.items) {
          const id = item.id || randomUUID();
          db.prepare("INSERT INTO expense_items VALUES(?,?,?,?,?)").run(
            id,
            e.id,
            item.title,
            item.quantity,
            item.unitPrice,
          );
          for (const a of item.allocations)
            db.prepare("INSERT INTO item_allocations VALUES(?,?,?)").run(
              id,
              a.memberId,
              a.weight,
            );
        }
        for (const kind of ["tax", "tip", "service", "discount"] as const)
          db.prepare("INSERT INTO expense_adjustments VALUES(?,?,?)").run(
            e.id,
            kind,
            e[kind],
          );
      }
      for (const s of h.settlements)
        db.prepare(
          "INSERT INTO settlements(id,hangout_id,from_id,to_id,amount,status,method) VALUES(?,?,?,?,?,?,?)",
        ).run(s.id, h.id, s.fromId, s.toId, s.amount, s.status, s.method);
      const keep = h.members.map((m) => m.id);
      const old = db
        .prepare("SELECT id FROM members WHERE hangout_id=?")
        .all(h.id) as { id: string }[];
      for (const m of old)
        if (!keep.includes(m.id))
          db.prepare("DELETE FROM members WHERE id=?").run(m.id);
      for (const [id, p] of Object.entries(h.preferences))
        db.prepare(
          "INSERT INTO settlement_preferences VALUES(?,?,?) ON CONFLICT(member_id) DO UPDATE SET method=excluded.method,details=excluded.details",
        ).run(id, p.method, p.details);
      db.prepare(
        "UPDATE invitations SET revoked=1 WHERE hangout_id=? AND token<>?",
      ).run(h.id, h.inviteToken);
      db.prepare(
        "INSERT OR IGNORE INTO invitations(token,hangout_id) VALUES(?,?)",
      ).run(h.inviteToken, h.id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return { db, load, save };
}
