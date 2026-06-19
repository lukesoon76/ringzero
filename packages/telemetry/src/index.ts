/**
 * @ring-zero/telemetry — Pillar P5 substrate (THIN, but the trace store + replay
 * are REAL). One run = one trace; governance-semantic spans; a SQLite store; and
 * FULL RUN REPLAY. A run lacking telemetry to reconstruct any binding decision is
 * flagged un-auditable (fail closed), never silently accepted.
 */

export const PACKAGE = "@ring-zero/telemetry";
export const STANCE = "THIN" as const;

export * from "./paths.js";
export { migrate } from "./migrate.js";
export * from "./store.js";
export * from "./otel.js";
