/**
 * Agent Autonomy (L1–L5) + Red Lines.
 *
 * Two governance primitives that let Regent speak the emerging general-purpose
 * agent safety standard (the L1–L5 framework) AND do the one thing a framework
 * or a monitor cannot: ENFORCE the safeguards each level prescribes.
 *
 *  - Autonomy levels L1–L5 classify an agent by how much it acts without a human
 *    in the loop. Higher autonomy ⇒ stricter binding enforcement (min tier, more
 *    deterministic controls, more red lines that must hold).
 *  - Red lines are NAMED hard prohibitions. Each is enforced either by a kernel
 *    constraint (fail-closed) or STRUCTURALLY by δ being a total function over the
 *    closed action set Π — an undefined transition cannot fire. Never advisory.
 *
 * This module is pure governance data + mapping (no agent types), so it stays in
 * `policy`; the per-agent conformance check lives in the SDK (which reads the
 * AgentManifest). Determinism-safe: no clock, no RNG.
 */

export type AutonomyLevel = 1 | 2 | 3 | 4 | 5;
type ControlKind = "guardrail" | "policy" | "verifier" | "human-oversight" | "containment";
/** A specific bound capability a level can require (finer-grained than a control kind). */
export type AutonomyCapability = "budget-cap";

/* ------------------------------------------------------------------ */
/* Red lines — named prohibitions, each mapped to a REAL mechanism.    */
/* ------------------------------------------------------------------ */
export type RedLineId =
  | "RL-ENUMERATED-ACTIONS"
  | "RL-DISPATCH-APPROVAL"
  | "RL-FRESH-SOURCED-DATA"
  | "RL-VERIFIED-FIGURES"
  | "RL-RELEASE-SIGNOFF";

export interface RedLine {
  readonly id: RedLineId;
  readonly name: string;
  readonly statement: string;
  /** The kernel constraint id or structural guarantee that makes this binding. */
  readonly enforcedBy: string;
  /** `structural` = impossible by construction (δ total over Π); `constraint` = fail-closed check. */
  readonly mechanism: "structural" | "constraint";
}

export const RED_LINES: readonly RedLine[] = [
  {
    id: "RL-ENUMERATED-ACTIONS",
    name: "No undefined actions",
    statement: "No action outside the closed, enumerated action set Π — undefined transitions cannot fire.",
    enforcedBy: "δ total over Π (UndefinedTransition)",
    mechanism: "structural",
  },
  {
    id: "RL-DISPATCH-APPROVAL",
    name: "No unauthorised external effect",
    statement: "No write or external dispatch without an authenticated approval on record.",
    enforcedBy: "approval-before-write-or-dispatch",
    mechanism: "constraint",
  },
  {
    id: "RL-FRESH-SOURCED-DATA",
    name: "No stale or off-allowlist evidence",
    statement: "No retrieval outside the source allowlist or beyond the recency window.",
    enforcedBy: "allowlist + recency guards",
    mechanism: "constraint",
  },
  {
    id: "RL-VERIFIED-FIGURES",
    name: "No unverified material figures",
    statement: "No binding action on a material figure that fails deterministic re-computation (Verified=1).",
    enforcedBy: "logical verifier (Verified attribute)",
    mechanism: "constraint",
  },
  {
    id: "RL-RELEASE-SIGNOFF",
    name: "No release without sign-off",
    statement: "No external release unless Verified=1 AND an authenticated human sign-off is present.",
    enforcedBy: "no-release-without-authenticated-signoff",
    mechanism: "constraint",
  },
];

export const RED_LINE_BY_ID: Readonly<Record<RedLineId, RedLine>> = Object.fromEntries(
  RED_LINES.map((r) => [r.id, r]),
) as Record<RedLineId, RedLine>;

/* ------------------------------------------------------------------ */
/* Autonomy levels — safeguards matched to each level.                 */
/* ------------------------------------------------------------------ */
export interface AutonomyDef {
  readonly level: AutonomyLevel;
  readonly code: string; // "L1".."L5"
  readonly name: string;
  readonly humanRole: string;
  readonly description: string;
  /** Recommended minimum enforcement tier (Θ intensity). */
  readonly minTier: 1 | 2 | 3 | 4;
  /** Deterministic control kinds that MUST be bound at this level. */
  readonly requiredControls: readonly ControlKind[];
  /** Specific bound capabilities that MUST be present at this level (finer than a kind). */
  readonly requiredCapabilities: readonly AutonomyCapability[];
  /** Red lines that must hold at this level (cumulative up the ladder). */
  readonly requiredRedLines: readonly RedLineId[];
}

export const AUTONOMY_LEVELS: readonly AutonomyDef[] = [
  {
    level: 1,
    code: "L1",
    name: "Assisted",
    humanRole: "Human performs every action; the agent only suggests.",
    description: "Tool-augmented. No autonomous effect on the world.",
    minTier: 1,
    requiredControls: [],
    requiredCapabilities: [],
    requiredRedLines: ["RL-ENUMERATED-ACTIONS"],
  },
  {
    level: 2,
    code: "L2",
    name: "Partial automation",
    humanRole: "Human approves every binding step.",
    description: "The agent executes sub-tasks; each external effect is gated on a human decision.",
    minTier: 2,
    requiredControls: ["human-oversight"],
    requiredCapabilities: [],
    requiredRedLines: ["RL-ENUMERATED-ACTIONS", "RL-DISPATCH-APPROVAL"],
  },
  {
    level: 3,
    code: "L3",
    name: "Conditional automation",
    humanRole: "Human supervises and can intervene.",
    description: "The agent runs end-to-end within scope; deterministic verification gates material outputs.",
    minTier: 3,
    requiredControls: ["verifier", "human-oversight"],
    requiredCapabilities: [],
    requiredRedLines: ["RL-ENUMERATED-ACTIONS", "RL-DISPATCH-APPROVAL", "RL-FRESH-SOURCED-DATA", "RL-VERIFIED-FIGURES"],
  },
  {
    level: 4,
    code: "L4",
    name: "High automation",
    humanRole: "Human out of the loop except on escalation.",
    description: "The agent acts autonomously in a bounded scope; containment and sign-off gate any release.",
    minTier: 4,
    requiredControls: ["verifier", "human-oversight", "containment"],
    requiredCapabilities: ["budget-cap"],
    requiredRedLines: ["RL-ENUMERATED-ACTIONS", "RL-DISPATCH-APPROVAL", "RL-FRESH-SOURCED-DATA", "RL-VERIFIED-FIGURES", "RL-RELEASE-SIGNOFF"],
  },
  {
    level: 5,
    code: "L5",
    name: "Full autonomy",
    humanRole: "Human is accountable owner only; the agent may set its own sub-goals.",
    description: "Self-directing. Every red line must hold structurally, under least privilege, with mandatory sign-off for external effects.",
    minTier: 4,
    requiredControls: ["verifier", "human-oversight", "containment", "policy"],
    requiredCapabilities: ["budget-cap"],
    requiredRedLines: ["RL-ENUMERATED-ACTIONS", "RL-DISPATCH-APPROVAL", "RL-FRESH-SOURCED-DATA", "RL-VERIFIED-FIGURES", "RL-RELEASE-SIGNOFF"],
  },
];

const LEVEL_BY_N = new Map(AUTONOMY_LEVELS.map((d) => [d.level, d]));

/** The safeguards Regent requires to govern an agent at the given autonomy level. */
export function enforcementForAutonomy(level: AutonomyLevel): AutonomyDef {
  return LEVEL_BY_N.get(level) ?? AUTONOMY_LEVELS[2]!; // default to L3 if out of range
}
