/**
 * @ring-zero/pillars — the thin-but-real pillar scaffold around the kernel:
 * agent registry + agent card (P1), 5-dimension risk tiering wired to enforcement
 * intensity (P2), and attestation export from real run evidence (P6).
 */

export const PACKAGE = "@ring-zero/pillars";
export const STANCE = "THIN" as const;

export * from "./tiering.js";
export * from "./registry.js";
export * from "./frameworks.js";
export * from "./attestation.js";
export * from "./render.js";
