import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "scorecard.db");

// Ensure the data directory exists (important for Docker volume mounts)
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// @libsql/client uses the file: protocol for local SQLite.
// Unlike better-sqlite3, it is async and has a pure-WASM fallback —
// no native compilation (node-gyp) required.
const client = createClient({ url: `file:${DB_PATH}` });

export const db = drizzle(client, { schema });

// Called once at server startup via src/instrumentation.ts
export async function runMigrations() {
  // executeMultiple runs a batch of DDL statements in one shot
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      settings TEXT DEFAULT '{}',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS session_players (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      team TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      label TEXT
    );

    CREATE TABLE IF NOT EXISTS round_scores (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES session_players(id) ON DELETE CASCADE,
      score REAL NOT NULL,
      metadata TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_rounds_session ON rounds(session_id);
    CREATE INDEX IF NOT EXISTS idx_scores_round ON round_scores(round_id);
    CREATE INDEX IF NOT EXISTS idx_players_session ON session_players(session_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sub TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Additive column migrations — ALTER TABLE ignores already-existing columns via PRAGMA check
  const sessionCols = await client.execute("PRAGMA table_info(sessions)");
  if (!sessionCols.rows.some((r) => r[1] === "user_id")) {
    await client.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id)");
  }

  const userCols = await client.execute("PRAGMA table_info(users)");
  if (!userCols.rows.some((r) => r[1] === "first_name")) {
    await client.execute("ALTER TABLE users ADD COLUMN first_name TEXT");
  }
  if (!userCols.rows.some((r) => r[1] === "last_name")) {
    await client.execute("ALTER TABLE users ADD COLUMN last_name TEXT");
  }
}
