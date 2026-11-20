import type { RemoteDatabase } from "./storage";
import { cadMigration } from "./cad-migration";
export async function migrateEmptyDatabase(db: RemoteDatabase, sql: string) {
  const tables = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  if (!tables.length) {
    await db.transaction(async () => {
      await db.exec(sql);
    });
    return;
  }
  const version = await db
    .prepare("SELECT max(version) AS version FROM migrations")
    .get();
  if (version?.version === 4) return;
  if (version?.version !== 3)
    throw Error("Unsupported remote schema; migration refused");
  // Official libSQL migrate batches run atomically with foreign keys disabled,
  // avoiding ON DELETE cascades while replacing the parent table constraint.
  await db.migrate([
    ...cadMigration.slice(0, -1),
    "CREATE TABLE cad_migration_check(violations INTEGER CHECK(violations=0));",
    "INSERT INTO cad_migration_check SELECT count(*) FROM pragma_foreign_key_check;",
    "DROP TABLE cad_migration_check;",
    cadMigration[cadMigration.length - 1],
  ]);
  if ((await db.prepare("PRAGMA foreign_key_check").all()).length)
    throw Error("Foreign key check failed after CAD migration");
}
