import { migrateEmptyDatabase } from "../server/migrations";
import { readFileSync, existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { remoteDatabase } from "../server/storage";
if (existsSync(".env")) loadEnvFile(".env");
const url = process.env.TURSO_DATABASE_URL;
if (!url || !/^(libsql|https):\/\//.test(url) || !process.env.TURSO_AUTH_TOKEN)
  throw Error(
    "Set remote Turso URL and token; local data is never migrated by this command",
  );
if (process.env.CONFIRM_DATABASE_MIGRATION !== "yes")
  throw Error(
    "Set CONFIRM_DATABASE_MIGRATION=yes after checking the target database",
  );
const db = remoteDatabase(url, process.env.TURSO_AUTH_TOKEN);
try {
  await migrateEmptyDatabase(
    db,
    readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  console.log("Database schema version 4 verified; no demo data inserted.");
} finally {
  db.close();
}
