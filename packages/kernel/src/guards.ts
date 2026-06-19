/**
 * The fixed-priority guard loop (see ../../ARCHITECTURE.md §5). Every guard is a
 * total, deterministic, bounded-time predicate f: S × Θ → {0,1}. NO LLM, no I/O,
 * no clock. Guards are evaluated in EXACTLY this priority order; the first to
 * fire dictates the control decision:
 *
 *   1. length-budget halt        Length ≥ Lmax            → HALT
 *   2. alignment → retrieve       Alignment < θ_A          → remediate(retrieve)
 *   3. unverified → verify        Verified ≠ 1             → remediate(verify)
 *   4. low-confidence → escalate  Confidence < θ_C         → ESCALATE
 *   5. verified + in-budget       Verified = 1 ∧ Length<Lmax→ CONTINUE
 *   6. else                       —                        → HALT (fallback)
 */

import type { GovernedState, Theta } from "./model.js";

export type GuardName =
  | "length-budget"
  | "alignment-retrieve"
  | "unverified-verify"
  | "low-confidence-escalate"
  | "verified-in-budget"
  | "fallback-halt";

export interface GuardEvaluation {
  readonly guard: GuardName;
  readonly fired: boolean;
  readonly score?: number;
  readonly threshold?: number;
  readonly detail: string;
  /** Binding-path guards are NEVER advisory. Kept explicit for telemetry parity. */
  readonly advisory: false;
}

export type GuardDecision =
  | { readonly kind: "continue" }
  | { readonly kind: "remediate"; readonly remediation: "retrieve" | "verify" }
  | {
      readonly kind: "terminal";
      readonly terminal: "Halt" | "Escalate" | "Abstain";
      readonly detail: string;
    };

export interface GuardLoopResult {
  readonly evaluations: readonly GuardEvaluation[];
  readonly decision: GuardDecision;
}

function evaluation(
  guard: GuardName,
  fired: boolean,
  detail: string,
  score?: number,
  threshold?: number,
): GuardEvaluation {
  return { guard, fired, detail, score, threshold, advisory: false };
}

/**
 * Run the fixed-priority guard loop once over a (already-validated) state.
 * Returns the ordered evaluations performed plus the decision the first fired
 * guard dictates. Total and deterministic by construction.
 */
export function runGuardLoop(state: GovernedState, theta: Theta): GuardLoopResult {
  const { Alignment, Verified, Length, Confidence } = state.attrs;
  const { thresholds, Lmax } = theta;
  const evaluations: GuardEvaluation[] = [];

  // 1. length-budget halt
  const overBudget = Length >= Lmax;
  evaluations.push(
    evaluation("length-budget", overBudget, `Length=${Length} vs Lmax=${Lmax}`, Length, Lmax),
  );
  if (overBudget) {
    return {
      evaluations,
      decision: { kind: "terminal", terminal: "Halt", detail: "length budget exhausted" },
    };
  }

  // 2. alignment → retrieve
  const lowAlignment = Alignment < thresholds.Alignment;
  evaluations.push(
    evaluation(
      "alignment-retrieve",
      lowAlignment,
      `Alignment=${Alignment} vs θ_A=${thresholds.Alignment}`,
      Alignment,
      thresholds.Alignment,
    ),
  );
  if (lowAlignment) {
    return { evaluations, decision: { kind: "remediate", remediation: "retrieve" } };
  }

  // 3. unverified → verify
  const unverified = Verified !== 1;
  evaluations.push(
    evaluation("unverified-verify", unverified, `Verified=${Verified}`, Verified, 1),
  );
  if (unverified) {
    return { evaluations, decision: { kind: "remediate", remediation: "verify" } };
  }

  // 4. low-confidence → escalate
  const lowConfidence = Confidence < thresholds.Confidence;
  evaluations.push(
    evaluation(
      "low-confidence-escalate",
      lowConfidence,
      `Confidence=${Confidence} vs θ_C=${thresholds.Confidence}`,
      Confidence,
      thresholds.Confidence,
    ),
  );
  if (lowConfidence) {
    return {
      evaluations,
      decision: { kind: "terminal", terminal: "Escalate", detail: "confidence below threshold" },
    };
  }

  // 5. verified + in-budget → continue
  const canContinue = Verified === 1 && Length < Lmax;
  evaluations.push(
    evaluation("verified-in-budget", canContinue, `Verified=1 ∧ Length=${Length}<Lmax=${Lmax}`),
  );
  if (canContinue) {
    return { evaluations, decision: { kind: "continue" } };
  }

  // 6. else → fallback halt
  evaluations.push(evaluation("fallback-halt", true, "no guard permitted continuation"));
  return {
    evaluations,
    decision: { kind: "terminal", terminal: "Halt", detail: "fallback halt" },
  };
}
