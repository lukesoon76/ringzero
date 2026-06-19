/**
 * Trajectory records. CRITICAL: the binding-path trace carries NO timestamps or
 * other non-deterministic fields — replay must be bit-identical (acceptance
 * criterion #3). Phase 4 telemetry adds wall-clock timing in a separate channel.
 */

import type { ConstraintCheck } from "./constraints.js";
import type { FailClosedReason } from "./errors.js";
import type { GuardEvaluation } from "./guards.js";
import type { GovernedAttributes, NodeId, Tier } from "./model.js";
import type { VerifyResult } from "./verifier.js";

export type StepOutcome = "applied" | "verified" | "blocked" | "terminated";

export interface TraceAction {
  readonly id: string;
  readonly kind: "capability" | "control";
  readonly intent: string;
}

export interface TransitionGuardRecord {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly score?: number;
  readonly threshold?: number;
}

export interface TraceStep {
  readonly index: number;
  readonly fromNode: NodeId;
  readonly toNode: NodeId;
  readonly action: TraceAction;
  readonly preAttrs: GovernedAttributes;
  readonly postAttrs: GovernedAttributes;
  readonly decision: string; // the guard-loop decision that drove this step
  readonly guardEvaluations: readonly GuardEvaluation[];
  readonly transitionGuard?: TransitionGuardRecord;
  readonly constraintChecks: readonly ConstraintCheck[];
  readonly verifyResult?: VerifyResult;
  readonly outcome: StepOutcome;
  readonly note?: string;
}

export type TerminalKind = "Halt" | "Escalate" | "Abstain" | "Complete";

export interface Terminal {
  readonly node: NodeId;
  readonly kind: TerminalKind;
  readonly detail: string;
  readonly failClosed?: FailClosedReason;
}

export interface Trajectory {
  readonly policyId: string;
  readonly tier: Tier;
  readonly s0: NodeId;
  readonly steps: readonly TraceStep[];
  readonly terminal: Terminal;
}
