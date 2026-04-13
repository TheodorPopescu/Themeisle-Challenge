import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { isAbsolute, resolve } from "node:path";
import * as schema from "./schema";

export type DbType = ReturnType<typeof drizzle<typeof schema>>;

let db: DbType | undefined;

function resolveDbFilePath() {
  const dbFileName = process.env.DB_FILE_NAME || "database.sqlite";
  if (isAbsolute(dbFileName)) {
    return dbFileName;
  }

  return resolve(import.meta.dir, "../../", dbFileName);
}

export function getDb(): DbType {
  if (!db) {
    const dbFile = resolveDbFilePath();
    const sqlite = new Database(dbFile);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export default getDb();
