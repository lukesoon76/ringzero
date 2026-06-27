/**
 * @ring-zero/policy — capability catalogue, the authoring DSL that compiles to a
 * labelled transition system W, the tier→Θ control map, and the credit-memo
 * policy used by the demo. See ../../ARCHITECTURE.md and ../../CLAUDE.md.
 */

export const PACKAGE = "@ring-zero/policy";
export const STANCE = "REAL" as const;

export * from "./capabilities.js";
export * from "./dsl.js";
export * from "./tiers.js";
export * from "./credit-memo.js";
export * from "./workflow-spec.js";
