/**
 * The verifier port. The kernel never measures wall-clock time on the binding
 * path (determinism), so a "timeout" is delivered to the kernel as a `timedOut`
 * flag in the result — the engine treats it as fail-closed. Phase 3 replaces the
 * default with the Python logical verifiers over JSON-RPC; the contract is
 * identical, so the engine and its tests do not change.
 *
 * A verifier returns a deterministic correctness GUARANTEE, never an opinion.
 */

import type { GovernedState, Theta } from "./model.js";

export interface VerifyResult {
  readonly verified: 0 | 1;
  readonly confidence: number; // [0,1]
  readonly timedOut: boolean;
  readonly detail: string;
}

export interface VerifierPort {
  readonly name: string;
  readonly verify: (state: GovernedState, theta: Theta) => VerifyResult;
}

/** Numeric check: a claimed value must match a recomputed value within tolerance. */
interface NumericCheck {
  readonly kind: "numeric";
  readonly label: string;
  readonly claimed: number;
  readonly recomputed: number;
  readonly tolerance: number;
}
/** Boolean assertion over already-derived facts. */
interface AssertCheck {
  readonly kind: "assert";
  readonly label: string;
  readonly ok: boolean;
}
type Check = NumericCheck | AssertCheck;

interface VerifyDirective {
  readonly simulateTimeout?: boolean;
  readonly checks?: readonly Check[];
}

function readDirective(state: GovernedState): VerifyDirective | undefined {
  const raw = state.data["_verify"];
  if (raw === null || typeof raw !== "object") return undefined;
  return raw as VerifyDirective;
}

/**
 * Default deterministic verifier. Reads an optional `_verify` directive from the
 * state's data and evaluates numeric/assertion checks. With no directive it
 * cannot establish verification and returns Verified=0 (fail closed — absence of
 * evidence is not evidence).
 */
export const defaultVerifier: VerifierPort = {
  name: "default-deterministic",
  verify(state: GovernedState): VerifyResult {
    const directive = readDirective(state);
    if (!directive) {
      return { verified: 0, confidence: 0, timedOut: false, detail: "no _verify directive present" };
    }
    if (directive.simulateTimeout === true) {
      return { verified: 0, confidence: 0, timedOut: true, detail: "verifier timed out" };
    }
    const checks = directive.checks ?? [];
    if (checks.length === 0) {
      return { verified: 0, confidence: 0, timedOut: false, detail: "no checks declared" };
    }

    let worstConfidence = 1;
    for (const check of checks) {
      if (check.kind === "assert") {
        if (!check.ok) {
          return {
            verified: 0,
            confidence: 0.2,
            timedOut: false,
            detail: `assertion failed: ${check.label}`,
          };
        }
        continue;
      }
      // numeric
      const diff = Math.abs(check.claimed - check.recomputed);
      if (diff > check.tolerance) {
        return {
          verified: 0,
          confidence: 0.2,
          timedOut: false,
          detail: `numeric mismatch: ${check.label} claimed=${check.claimed} recomputed=${check.recomputed} (Δ=${diff} > tol=${check.tolerance})`,
        };
      }
      const scale = Math.max(Math.abs(check.recomputed), 1e-9);
      const closeness = 1 - Math.min(diff / scale, 1);
      worstConfidence = Math.min(worstConfidence, closeness);
    }

    return {
      verified: 1,
      confidence: worstConfidence,
      timedOut: false,
      detail: `all ${checks.length} check(s) passed`,
    };
  },
};
