/**
 * @ring-zero/telemetry — Pillar P5 substrate (THIN, but the trace store is REAL).
 *
 * OpenTelemetry governance-semantic traces (one run = one trace), a SQLite store,
 * and FULL RUN REPLAY. A run lacking telemetry to reconstruct any binding
 * decision is flagged un-auditable (fail closed), never silently accepted.
 *
 * Phase 0: stub + the SQLite migration runner (see ./migrate.ts). Instrumentation
 * and replay land in Phase 4.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE = "@ring-zero/telemetry";
export const PHASE = 0;
export const STANCE = "THIN" as const;

const here = dirname(fileURLToPath(import.meta.url));

/** Default on-disk location of the demo's SQLite store (file-based, zero-setup). */
export const DEFAULT_DB_PATH = resolve(process.cwd(), ".telemetry", "ring-zero.db");

/** Directory holding ordered `NNNN_*.sql` migration files. */
export const MIGRATIONS_DIR = resolve(here, "..", "migrations");
