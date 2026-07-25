import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

function getDbPath(): string {
  const dataDir = process.env.HUMANSEO_DATA_DIR
    || path.join(process.env.HOME || process.env.USERPROFILE || ".", ".humanseo");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "humanseo.db");
}

const sqlite = new Database(getDbPath());

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export * from "./schema";

// Re-export the raw sqlite instance for migrations
export { sqlite };
