/**
 * Human oversight modes — the spectrum of human capacity over an agent, from
 * approving every action to none at all. This is EU AI Act Art. 14 made concrete:
 * each mode maps to what the kernel actually enforces and to the autonomy levels
 * it fits. Higher autonomy shifts the human from *in* the loop to *on* / *over*
 * it — but never removes accountability, and never removes the deterministic red
 * lines and containment that hold even when no human is watching.
 *
 * Pure governance data + mapping (no agent types); the per-agent derivation lives
 * in the SDK. Determinism-safe: no clock, no RNG.
 */

import type { AutonomyLevel } from "./autonomy.js";

export type OversightModeId = "hitl" | "hotl" | "hic" | "autonomous";

export interface OversightMode {
  readonly id: OversightModeId;
  readonly code: string; // "HITL" | "HOTL" | "HIC" | "OOTL"
  readonly name: string;
  readonly humanRole: string;
  readonly description: string;
  /** When the human acts relative to the agent. */
  readonly latency: "before each action" | "real-time" | "after the fact" | "policy-time only";
  /** What Regent's kernel enforces to make this mode binding, not aspirational. */
  readonly enforcement: string;
  /** The EU AI Act Art. 14 oversight measure this realises. */
  readonly euAiActArt14: string;
  /** Autonomy levels this mode is appropriate for. */
  readonly autonomyLevels: readonly AutonomyLevel[];
}

export const OVERSIGHT_MODES: readonly OversightMode[] = [
  {
    id: "hitl",
    code: "HITL",
    name: "Human-in-the-loop",
    humanRole: "Approves every binding action before it executes.",
    description: "The agent proposes; a human validates each external effect before it happens. Nothing binds without a signed decision.",
    latency: "before each action",
    enforcement: "approval-before-write-or-dispatch on every binding step (no write/dispatch without an authenticated, node-scoped approval).",
    euAiActArt14: "Art. 14(4)(d) — decide not to use / disregard / reverse the output before it takes effect.",
    autonomyLevels: [1, 2],
  },
  {
    id: "hotl",
    code: "HOTL",
    name: "Human-on-the-loop",
    humanRole: "Monitors in real time; can intervene or halt at any point.",
    description: "The agent acts autonomously within scope; a human supervises the live trajectory and exceptions escalate to them. They don't gate each step, but they can stop it.",
    latency: "real-time",
    enforcement: "deterministic verifiers + guards escalate (contain) on any failure to an authenticated human; live replayable trace; kill-switch halts the agent and contains everything downstream.",
    euAiActArt14: "Art. 14(4)(a,e) — remain aware of automation bias and intervene / stop via a 'stop' button.",
    autonomyLevels: [3, 4],
  },
  {
    id: "hic",
    code: "HIC",
    name: "Human-in-command (over-the-loop)",
    humanRole: "Sets policy and reviews after the fact; retains the kill-switch and accountability.",
    description: "A human defines the mandate and reviews outcomes; there is no per-action gate. The agent runs; every decision is reproducibly logged for post-hoc review, and the human can pull the plug.",
    latency: "after the fact",
    enforcement: "policy bound as a closed transition system (undefined actions impossible); cumulative-exposure + budget caps contain runaway; forensic replay ledger for every decision; kill-switch retained.",
    euAiActArt14: "Art. 14(2) — oversight proportionate to risk, with reproducible records enabling meaningful post-hoc accountability.",
    autonomyLevels: [4, 5],
  },
  {
    id: "autonomous",
    code: "OOTL",
    name: "Out-of-the-loop (bounded-autonomous)",
    humanRole: "No human in the runtime path; accountable owner only.",
    description: "No human intervenes at runtime. The only things that stop the agent are the deterministic red lines and containment — which is exactly why they must be structural, not advisory.",
    latency: "policy-time only",
    enforcement: "red lines enforced structurally (δ total over Π — prohibited transitions cannot fire) + fail-closed constraints + containment on unknown state. Sign-off still required for any external release.",
    euAiActArt14: "Art. 14(1) — permitted only where oversight is designed-in structurally; not appropriate for high-risk actions without a stronger mode.",
    autonomyLevels: [5],
  },
];

const MODE_BY_ID = new Map(OVERSIGHT_MODES.map((m) => [m.id, m]));
export function oversightMode(id: OversightModeId): OversightMode {
  return MODE_BY_ID.get(id) ?? OVERSIGHT_MODES[1]!;
}

/**
 * The recommended oversight mode for an autonomy level. As autonomy rises the
 * human moves from IN the loop (approve each) → ON the loop (supervise/intervene)
 * → IN COMMAND (policy + post-hoc). L5 may run out-of-the-loop only within a
 * bounded scope where red lines hold structurally.
 */
export function oversightModeForAutonomy(level: AutonomyLevel): OversightModeId {
  if (level <= 2) return "hitl";
  if (level === 3) return "hotl";
  if (level === 4) return "hotl";
  return "hic"; // L5 default: human-in-command (OOTL only when explicitly bounded)
}
