/**
 * Trajectory (temporal / path) constraints — checked BEFORE every transition.
 * A step that would violate any applicable constraint is blocked and the engine
 * fails closed. These are path properties, distinct from the per-step guard loop.
 *
 *   1. approval-before-write-or-dispatch       no write/dispatch without an authenticated approval
 *   2. no-write-after-sensitive-data           once sensitive data is flagged, no further writes
 *   3. no-release-without-authenticated-signoff no external release unless Verified=1 AND signed off
 */

import type { ApprovalVerifier } from "./approval.js";
import type { GovernedState, Theta } from "./model.js";
import type { Action } from "./transition.js";

export type ConstraintName =
  | "approval-before-write-or-dispatch"
  | "no-write-after-sensitive-data"
  | "no-release-without-authenticated-signoff";

export interface ConstraintCheck {
  readonly constraint: ConstraintName;
  readonly applicable: boolean;
  readonly pass: boolean;
  readonly detail: string;
}

export interface ConstraintContext {
  readonly state: GovernedState;
  readonly action: Action;
  readonly theta: Theta;
  readonly approvalVerifier: ApprovalVerifier;
}

const WRITE_OR_DISPATCH = new Set<Action["intent"]>(["write", "dispatch"]);

function approvalBeforeWriteOrDispatch(ctx: ConstraintContext): ConstraintCheck {
  const applicable = WRITE_OR_DISPATCH.has(ctx.action.intent);
  if (!applicable) {
    return {
      constraint: "approval-before-write-or-dispatch",
      applicable: false,
      pass: true,
      detail: `intent=${ctx.action.intent} is not write/dispatch`,
    };
  }
  const record = ctx.state.flags.approvalRecord;
  const auth = ctx.approvalVerifier.isAuthentic(record, ctx.state.node);
  return {
    constraint: "approval-before-write-or-dispatch",
    applicable: true,
    pass: auth.authentic,
    detail: auth.detail,
  };
}

function noWriteAfterSensitiveData(ctx: ConstraintContext): ConstraintCheck {
  const applicable = ctx.action.intent === "write" && ctx.state.flags.sensitiveData;
  return {
    constraint: "no-write-after-sensitive-data",
    applicable,
    pass: !applicable,
    detail: applicable
      ? "write attempted after sensitive-data flag set"
      : `sensitiveData=${ctx.state.flags.sensitiveData}, intent=${ctx.action.intent}`,
  };
}

function noReleaseWithoutSignoff(ctx: ConstraintContext): ConstraintCheck {
  const applicable = ctx.action.intent === "dispatch";
  if (!applicable) {
    return {
      constraint: "no-release-without-authenticated-signoff",
      applicable: false,
      pass: true,
      detail: `intent=${ctx.action.intent} is not an external release`,
    };
  }
  const verified = ctx.state.attrs.Verified === 1;
  const auth = ctx.approvalVerifier.isAuthentic(ctx.state.flags.approvalRecord, ctx.state.node);
  const pass = verified && auth.authentic;
  return {
    constraint: "no-release-without-authenticated-signoff",
    applicable: true,
    pass,
    detail: pass
      ? "Verified=1 and authenticated sign-off present"
      : `release blocked — Verified=${ctx.state.attrs.Verified}, approval: ${auth.detail}`,
  };
}

/** Evaluate all trajectory constraints for a proposed (state, action). */
export function checkTrajectoryConstraints(ctx: ConstraintContext): readonly ConstraintCheck[] {
  return [
    approvalBeforeWriteOrDispatch(ctx),
    noWriteAfterSensitiveData(ctx),
    noReleaseWithoutSignoff(ctx),
  ];
}

/** The first applicable failing constraint, if any. */
export function firstViolation(
  checks: readonly ConstraintCheck[],
): ConstraintCheck | undefined {
  return checks.find((c) => c.applicable && !c.pass);
}
