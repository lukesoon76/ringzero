import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Default on-disk location of the demo's SQLite store (file-based, zero-setup). */
export const DEFAULT_DB_PATH = resolve(process.cwd(), ".telemetry", "ring-zero.db");

/** Directory holding ordered `NNNN_*.sql` migration files. */
export const MIGRATIONS_DIR = resolve(here, "..", "migrations");
