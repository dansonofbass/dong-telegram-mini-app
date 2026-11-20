/** Rebuild only the currency constraint, preserving all columns and dependent records. */
export const cadMigration = [
  "CREATE TABLE hangouts_cad(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN ('AMD','USD','EUR','USDT','CAD')),document TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP, version INTEGER NOT NULL DEFAULT 0);",
  "INSERT INTO hangouts_cad SELECT * FROM hangouts;",
  "DROP TABLE hangouts;",
  "ALTER TABLE hangouts_cad RENAME TO hangouts;",
  "INSERT INTO migrations(version) VALUES(4);",
];
