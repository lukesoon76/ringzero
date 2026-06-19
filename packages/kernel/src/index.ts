/**
 * @ring-zero/kernel ★ REAL (deep) — Pillar P4: Runtime Execution Governance.
 *
 * The deterministic execution-governance kernel: the governed-object model and
 * its runtime validation, the labelled transition system W = (s0, S, Π, δ), the
 * fixed-priority guard engine f: S×Θ→{0,1}, the trajectory constraints,
 * authenticated approval, the verifier port, tiered fail-closed containment, and
 * the trajectory recorder. Pure, deterministic, bounded-time — NO LLM on the
 * binding path. See ../../ARCHITECTURE.md.
 */

export const PACKAGE = "@ring-zero/kernel";
export const STANCE = "REAL" as const;

export * from "./model.js";
export * from "./errors.js";
export * from "./transition.js";
export * from "./guards.js";
export * from "./constraints.js";
export * from "./approval.js";
export * from "./verifier.js";
export * from "./trace.js";
export * from "./engine.js";
