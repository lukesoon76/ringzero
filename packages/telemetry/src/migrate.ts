/**
 * SQLite schema migration runner (Phase 0 infrastructure).
 *
 * Applies ordered `NNNN_name.sql` files from ./migrations exactly once each,
 * inside a transaction, recording name + checksum in `schema_migrations`.
 * Idempotent: re-running applies only new migrations. Fails closed — any error
 * rolls back the offending migration.
 *
 * Usage:  pnpm db:migrate            (uses DEFAULT_DB_PATH)
 *         tsx src/migrate.ts <db>    (explicit path)
 */

import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_DB_PATH, MIGRATIONS_DIR } from "./paths.js";

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function migrate(
  dbPath: string = DEFAULT_DB_PATH,
  migrationsDir: string = MIGRATIONS_DIR,
): MigrationResult {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const seen = new Set<string>(
    db
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((r) => (r as { name: string }).name),
  );

  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const file of files) {
    if (seen.has(file)) {
      alreadyApplied.push(file);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const checksum = sha256(sql);
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)").run(
        file,
        checksum,
      );
    });
    tx();
    applied.push(file);
  }

  db.close();
  return { applied, alreadyApplied };
}

// Run as a CLI when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] ?? DEFAULT_DB_PATH;
  const result = migrate(dbPath);
  const total = result.applied.length + result.alreadyApplied.length;
  console.log(`[ring-zero] migrate → ${dbPath}`);
  console.log(`  applied: ${result.applied.length ? result.applied.join(", ") : "(none)"}`);
  console.log(`  up-to-date: ${total} migration(s) total`);
}
