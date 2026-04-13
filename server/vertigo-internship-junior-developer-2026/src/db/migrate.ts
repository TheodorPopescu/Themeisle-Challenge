import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { isAbsolute, resolve } from "node:path";
import * as schema from "./schema";

function resolveDbFilePath() {
    const dbFileName = process.env.DB_FILE_NAME || "database.sqlite";
    if (isAbsolute(dbFileName)) {
        return dbFileName;
    }

    return resolve(import.meta.dir, "../../", dbFileName);
}

function ensureBetCashoutColumns(sqlite: Database) {
    const columns = sqlite
        .query("PRAGMA table_info(bets)")
        .all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has("cashed_out_at")) {
        sqlite.exec("ALTER TABLE bets ADD COLUMN cashed_out_at integer");
    }

    if (!columnNames.has("cashed_out_amount")) {
        sqlite.exec("ALTER TABLE bets ADD COLUMN cashed_out_amount real");
    }
}

export async function runMigrations() {
    const dbFile = resolveDbFilePath();
    const sqlite = new Database(dbFile);
    const db = drizzle(sqlite, { schema });

    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: resolve(import.meta.dir, "../../drizzle") });
    ensureBetCashoutColumns(sqlite);
    console.log("✅ Migrations completed");
    sqlite.close();
}

if (import.meta.main) {
    await runMigrations();
}
