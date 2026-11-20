import { cadMigration } from "./cad-migration";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Hangout } from "../shared/engine.js";
import { expenseShares } from "../shared/engine.js";
export type LogInput = {
  actorUserId: string;
  type: string;
  resourceId?: string;
  metadata?: Record<string, string | number | boolean>;
};
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
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=2").get()) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE users ADD COLUMN telegram_id TEXT;
      ALTER TABLE users ADD COLUMN username TEXT;
      ALTER TABLE users ADD COLUMN avatar_url TEXT;
      ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 1;
      CREATE UNIQUE INDEX users_telegram ON users(telegram_id) WHERE telegram_id IS NOT NULL;
      ALTER TABLE hangouts ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE expenses ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
      ALTER TABLE expense_adjustments ADD COLUMN mode TEXT NOT NULL DEFAULT 'fixed';
      ALTER TABLE expense_adjustments ADD COLUMN input_value INTEGER;
      ALTER TABLE invitations ADD COLUMN expires_at TEXT;
      UPDATE invitations SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days');
      CREATE TABLE guest_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX guest_session_user ON guest_sessions(user_id);
      CREATE TABLE receiving_methods(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('card','bank','wallet','cash','other')),label TEXT NOT NULL,value TEXT NOT NULL,recipient_name TEXT NOT NULL DEFAULT '',bank_name TEXT NOT NULL DEFAULT '',network TEXT NOT NULL DEFAULT '',preferred INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE UNIQUE INDEX receiving_preferred ON receiving_methods(user_id) WHERE preferred=1;
      ALTER TABLE settlements ADD COLUMN receiving_method_id TEXT;
      CREATE TABLE activity_log(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,hangout_id TEXT NOT NULL REFERENCES hangouts(id),actor_user_id TEXT NOT NULL REFERENCES users(id),event_type TEXT NOT NULL,resource_id TEXT,metadata TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX activity_hangout_sequence ON activity_log(hangout_id,sequence DESC);
      UPDATE users SET telegram_id=substr(id,4) WHERE id LIKE 'tg-%';
      UPDATE expenses SET created_by_user_id=(SELECT owner_id FROM hangouts WHERE hangouts.id=expenses.hangout_id);
      INSERT INTO migrations(version) VALUES(2);`);
    const rows = db
      .prepare("SELECT id,owner_id,document FROM hangouts")
      .all() as { id: string; owner_id: string; document: string }[];
    try {
      for (const row of rows) {
        const h = JSON.parse(row.document) as Hangout;
        h.version = 0;
        for (const e of h.expenses) {
          e.createdByUserId ||= row.owner_id;
          e.revision ||= 1;
        }
        db.prepare("UPDATE hangouts SET document=? WHERE id=?").run(
          JSON.stringify(h),
          row.id,
        );
        for (const [mid, p] of Object.entries(h.preferences)) {
          const m = h.members.find((m) => m.id === mid);
          if (m?.userId && p.details)
            db.prepare(
              "INSERT INTO receiving_methods(id,user_id,kind,label,value) VALUES(?,?,?,?,?)",
            ).run(randomUUID(), m.userId, p.method, "", p.details);
        }
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=3").get())
    db.exec(
      `BEGIN IMMEDIATE; ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''; ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''; INSERT INTO migrations(version) VALUES(3); COMMIT;`,
    );
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=4").get()) {
    // VACUUM INTO creates a consistent snapshot before changing an existing file.
    if (path !== ":memory:") {
      const backupPath = path + ".before-cad-" + randomUUID() + ".sqlite";
      db.exec("VACUUM INTO '" + backupPath.replaceAll("'", "''") + "'");
      const backup = new DatabaseSync(backupPath);
      try { if (backup.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok") throw Error("CAD migration backup verification failed"); }
      finally { backup.close(); }
    }
    db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
    try {
      for (const sql of cadMigration) db.exec(sql);
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw Error("CAD migration foreign key check failed");
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    finally { db.exec("PRAGMA foreign_keys=ON"); }
  }
  const load = (id: string) => {
    const row = db
      .prepare("SELECT document FROM hangouts WHERE id=?")
      .get(id) as { document: string } | undefined;
    return row ? (JSON.parse(row.document) as Hangout) : undefined;
  };
  function log(hangoutId: string, event: LogInput) {
    db.prepare(
      "INSERT INTO activity_log(id,hangout_id,actor_user_id,event_type,resource_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      hangoutId,
      event.actorUserId,
      event.type,
      event.resourceId || null,
      JSON.stringify(event.metadata || {}),
      new Date().toISOString(),
    );
  }
  function save(
    h: Hangout,
    events: LogInput[] = [],
    submission?: { userId: string; key: string; response: string },
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = db
        .prepare("SELECT version FROM hangouts WHERE id=?")
        .get(h.id) as { version: number } | undefined;
      if (current && current.version !== (h.version || 0))
        throw Object.assign(Error("conflict"), { statusCode: 409 });
      h.version = (h.version || 0) + 1;
      db.prepare(
        "INSERT INTO hangouts(id,owner_id,title,currency,document) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,document=excluded.document,updated_at=CURRENT_TIMESTAMP",
      ).run(h.id, h.ownerId, h.title, h.currency, JSON.stringify(h));
      db.prepare("UPDATE hangouts SET version=? WHERE id=?").run(
        h.version,
        h.id,
      );
      for (const m of h.members)
        db.prepare(
          "INSERT INTO members(id,hangout_id,user_id,name) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
        ).run(m.id, h.id, m.userId, m.name);
      db.prepare("DELETE FROM settlements WHERE hangout_id=?").run(h.id);
      db.prepare("DELETE FROM expenses WHERE hangout_id=?").run(h.id);
      for (const e of h.expenses) {
        db.prepare(
          "INSERT INTO expenses(id,hangout_id,payer_id,title,created_by_user_id) VALUES(?,?,?,?,?)",
        ).run(e.id, h.id, e.payerId, e.title, e.createdByUserId || h.ownerId);
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
          db.prepare(
            "INSERT INTO expense_adjustments(expense_id,kind,amount,mode,input_value) VALUES(?,?,?,?,?)",
          ).run(
            e.id,
            kind,
            expenseShares(e).adjustments[kind],
            e.adjustments?.[kind]?.mode || "fixed",
            e.adjustments?.[kind]?.value ?? e[kind],
          );
      }
      for (const s of h.settlements)
        db.prepare(
          "INSERT INTO settlements(id,hangout_id,from_id,to_id,amount,status,method,receiving_method_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        ).run(
          s.id,
          h.id,
          s.fromId,
          s.toId,
          s.amount,
          s.status,
          s.method,
          s.receivingMethodId || null,
          s.createdAt,
        );
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
        "INSERT OR IGNORE INTO invitations(token,hangout_id,expires_at) VALUES(?,?,?)",
      ).run(
        h.inviteToken,
        h.id,
        new Date(Date.now() + 30 * 86400000).toISOString(),
      );
      for (const event of events) log(h.id, event);
      if (submission)
        db.prepare(
          "INSERT INTO submissions(user_id,key,response) VALUES(?,?,?)",
        ).run(submission.userId, submission.key, submission.response);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return { db, load, save, log };
}
