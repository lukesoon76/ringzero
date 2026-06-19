/**
 * The execution-governance engine: drives a policy's transition system W to a
 * terminal state under the fixed-priority guard loop, the trajectory
 * constraints, and tiered fail-closed containment — recording every step.
 *
 * Execution model (reconciling the universal guard loop with staged
 * orchestration): the state's ATTRIBUTES encode progress. Each step:
 *   1. terminal node            → Complete
 *   2. run the fixed-priority guard loop → decision
 *   3. act on the decision:
 *        terminal(Halt/Escalate/Abstain) → end
 *        retrieve  → take an evidence-gathering edge (intent read|retrieve)
 *        verify    → run the verifier PORT (verified=1 advances; 0 → escalate
 *                    with discrepancy; timeout → fail closed)
 *        continue  → take the forward edge (lowest priority whose guard passes)
 *   before any δ: trajectory constraints are checked; a violation fails closed.
 *
 * Determinism: no clock, no RNG, no LLM on this path. Bounded time: the loop can
 * run at most Lmax iterations (hard cap) regardless of effects, so it always
 * halts. The engine OWNS the Length attribute — it increments by 1 each step so
 * the length-budget guard is always meaningful.
 */

import { defaultApprovalVerifier, type ApprovalVerifier } from "./approval.js";
import {
  checkTrajectoryConstraints,
  firstViolation,
  type ConstraintCheck,
} from "./constraints.js";
import { UndefinedTransition, type FailClosedReason } from "./errors.js";
import { runGuardLoop, type GuardDecision, type GuardLoopResult } from "./guards.js";
import {
  validateState,
  type GovernedState,
  type NodeId,
  type Theta,
} from "./model.js";
import type { Terminal, TraceStep, Trajectory, TransitionGuardRecord } from "./trace.js";
import {
  delta,
  firstPassing,
  type Action,
  type Edge,
  type GuardCheck,
  type TransitionSystem,
} from "./transition.js";
import { defaultVerifier, type VerifierPort, type VerifyResult } from "./verifier.js";

export interface EngineDeps {
  readonly verifier?: VerifierPort;
  readonly approvalVerifier?: ApprovalVerifier;
}

type Pick =
  | { readonly kind: "edge"; readonly edge: Edge; readonly guard?: GuardCheck }
  | { readonly kind: "escalate"; readonly guard?: GuardCheck; readonly detail: string }
  | { readonly kind: "halt"; readonly detail: string };

function decisionLabel(decision: GuardDecision): string {
  switch (decision.kind) {
    case "continue":
      return "continue";
    case "remediate":
      return decision.remediation;
    case "terminal":
      return `terminal:${decision.terminal}`;
  }
}

function withLength(state: GovernedState, length: number): GovernedState {
  return { ...state, attrs: { ...state.attrs, Length: length } };
}

function guardRecord(edge: Edge, guard: GuardCheck | undefined): TransitionGuardRecord | undefined {
  if (!edge.guard || !guard) return undefined;
  return {
    name: edge.guard.name,
    pass: guard.pass,
    detail: guard.detail,
    score: guard.score,
    threshold: guard.threshold,
  };
}

function selectForward(W: TransitionSystem, state: GovernedState, theta: Theta): Pick {
  const edges = W.outgoing.get(state.node) ?? [];
  if (edges.length === 0) return { kind: "halt", detail: "no outgoing edges (fallback halt)" };
  const passing = firstPassing(edges, state, theta);
  if (passing) return { kind: "edge", edge: passing.edge, guard: passing.guard };
  const top = edges[0];
  const guard = top?.guard?.check(state, theta);
  return {
    kind: "escalate",
    guard,
    detail:
      top?.guard && guard
        ? `transition guard failed: ${top.guard.name} — ${guard.detail}`
        : "no forward action permitted",
  };
}

function selectEvidence(W: TransitionSystem, state: GovernedState, theta: Theta): Pick {
  const edges = (W.outgoing.get(state.node) ?? []).filter(
    (e) => e.action.intent === "read" || e.action.intent === "retrieve",
  );
  if (edges.length === 0) {
    return { kind: "escalate", detail: "low alignment and no evidence-gathering action available" };
  }
  const passing = firstPassing(edges, state, theta);
  if (passing) return { kind: "edge", edge: passing.edge, guard: passing.guard };
  const top = edges[0];
  const guard = top?.guard?.check(state, theta);
  return {
    kind: "escalate",
    guard,
    detail:
      top?.guard && guard
        ? `evidence retrieval blocked: ${top.guard.name} — ${guard.detail}`
        : "evidence retrieval unavailable",
  };
}

function traceAction(action: Action): TraceStep["action"] {
  return { id: action.id, kind: action.kind, intent: action.intent };
}

function containment(theta: Theta, node: NodeId, reason: FailClosedReason): Terminal {
  return {
    node,
    kind: theta.defaultContainment,
    detail: `fail-closed: ${reason.kind} — ${reason.detail}`,
    failClosed: reason,
  };
}

export function runTrajectory(
  W: TransitionSystem,
  theta: Theta,
  initial: GovernedState,
  deps: EngineDeps = {},
): Trajectory {
  const verifier = deps.verifier ?? defaultVerifier;
  const approvalVerifier = deps.approvalVerifier ?? defaultApprovalVerifier;
  const steps: TraceStep[] = [];
  let state = initial;
  let index = 0;
  const hardCap = Math.max(1, theta.Lmax);

  const finish = (terminal: Terminal): Trajectory => ({
    policyId: W.id,
    tier: theta.tier,
    s0: initial.node,
    steps,
    terminal,
  });

  for (;;) {
    if (W.terminals.has(state.node)) {
      return finish({ node: state.node, kind: "Complete", detail: "reached terminal node" });
    }
    if (index >= hardCap) {
      return finish({
        node: state.node,
        kind: "Halt",
        detail: `hard step cap (Lmax=${theta.Lmax}) reached`,
      });
    }

    const loop: GuardLoopResult = runGuardLoop(state, theta);
    const decision = loop.decision;

    // (a) guard loop says stop.
    if (decision.kind === "terminal") {
      steps.push({
        index,
        fromNode: state.node,
        toNode: state.node,
        action: { id: decision.terminal.toLowerCase(), kind: "control", intent: "control" },
        preAttrs: state.attrs,
        postAttrs: state.attrs,
        decision: decisionLabel(decision),
        guardEvaluations: loop.evaluations,
        constraintChecks: [],
        outcome: "terminated",
        note: decision.detail,
      });
      return finish({ node: state.node, kind: decision.terminal, detail: decision.detail });
    }

    // (b) guard loop says verify → run the verifier port.
    if (decision.kind === "remediate" && decision.remediation === "verify") {
      const vr: VerifyResult = verifier.verify(state, theta);
      if (vr.timedOut) {
        steps.push(verifyStep(index, state, state, loop, vr, "blocked", "verifier timeout → fail closed"));
        return finish(containment(theta, state.node, { kind: "verifier-timeout", detail: vr.detail }));
      }
      if (vr.verified === 0) {
        steps.push(
          verifyStep(index, state, state, loop, vr, "blocked", `verification failed → escalate: ${vr.detail}`),
        );
        return finish({
          node: state.node,
          kind: theta.defaultContainment,
          detail: `verification failed: ${vr.detail}`,
          failClosed: { kind: "verifier-error", detail: vr.detail },
        });
      }
      const validated = validateState({
        node: state.node,
        attrs: { ...state.attrs, Verified: vr.verified, Confidence: vr.confidence, Length: state.attrs.Length + 1 },
        flags: state.flags,
        data: state.data,
      });
      if (!validated.ok) {
        steps.push(verifyStep(index, state, state, loop, vr, "blocked", validated.reason));
        return finish(containment(theta, state.node, { kind: "unknown-state", detail: validated.reason }));
      }
      steps.push(verifyStep(index, state, validated.value, loop, vr, "verified", "verification passed"));
      state = validated.value;
      index++;
      continue;
    }

    // (c) retrieve or continue → choose an edge.
    const pick = decision.kind === "remediate" ? selectEvidence(W, state, theta) : selectForward(W, state, theta);

    if (pick.kind === "halt") {
      steps.push(blockedStep(index, state, loop, undefined, [], pick.detail, undefined));
      return finish({ node: state.node, kind: "Halt", detail: pick.detail });
    }
    if (pick.kind === "escalate") {
      steps.push(blockedStep(index, state, loop, undefined, [], pick.detail, undefined));
      return finish({
        node: state.node,
        kind: theta.defaultContainment,
        detail: pick.detail,
        failClosed: { kind: "transition-guard-failed", detail: pick.detail },
      });
    }

    const edge = pick.edge;
    const action = edge.action;

    // trajectory constraints BEFORE the transition.
    const constraintChecks = checkTrajectoryConstraints({ state, action, theta, approvalVerifier });
    const violation = firstViolation(constraintChecks);
    if (violation) {
      steps.push(
        blockedStep(index, state, loop, action, constraintChecks, violation.detail, guardRecord(edge, pick.guard)),
      );
      return finish({
        node: state.node,
        kind: theta.defaultContainment,
        detail: violation.detail,
        failClosed: {
          kind: "constraint-violation",
          detail: `${violation.constraint}: ${violation.detail}`,
        },
      });
    }

    // apply δ (throws on undefined transition — structurally impossible edges).
    let next: GovernedState;
    try {
      const result = delta(W, state, action, theta);
      if (!result.next.ok) {
        steps.push(
          blockedStep(index, state, loop, action, constraintChecks, result.next.reason, guardRecord(edge, pick.guard)),
        );
        return finish(containment(theta, state.node, { kind: "unknown-state", detail: result.next.reason }));
      }
      next = withLength(result.next.value, state.attrs.Length + 1);
    } catch (err) {
      const detail = err instanceof UndefinedTransition ? err.message : String(err);
      steps.push(blockedStep(index, state, loop, action, constraintChecks, detail, guardRecord(edge, pick.guard)));
      return finish(containment(theta, state.node, { kind: "undefined-transition", detail }));
    }

    steps.push({
      index,
      fromNode: state.node,
      toNode: next.node,
      action: traceAction(action),
      preAttrs: state.attrs,
      postAttrs: next.attrs,
      decision: decisionLabel(decision),
      guardEvaluations: loop.evaluations,
      transitionGuard: guardRecord(edge, pick.guard),
      constraintChecks,
      outcome: "applied",
    });
    state = next;
    index++;
  }
}

function verifyStep(
  index: number,
  from: GovernedState,
  to: GovernedState,
  loop: GuardLoopResult,
  vr: VerifyResult,
  outcome: TraceStep["outcome"],
  note: string,
): TraceStep {
  return {
    index,
    fromNode: from.node,
    toNode: to.node,
    action: { id: "verify", kind: "control", intent: "compute" },
    preAttrs: from.attrs,
    postAttrs: to.attrs,
    decision: "verify",
    guardEvaluations: loop.evaluations,
    constraintChecks: [],
    verifyResult: vr,
    outcome,
    note,
  };
}

function blockedStep(
  index: number,
  state: GovernedState,
  loop: GuardLoopResult,
  action: Action | undefined,
  constraintChecks: readonly ConstraintCheck[],
  note: string,
  transitionGuard: TransitionGuardRecord | undefined,
): TraceStep {
  return {
    index,
    fromNode: state.node,
    toNode: state.node,
    action: action ? traceAction(action) : { id: "(none)", kind: "control", intent: "control" },
    preAttrs: state.attrs,
    postAttrs: state.attrs,
    decision: decisionLabel(loop.decision),
    guardEvaluations: loop.evaluations,
    transitionGuard,
    constraintChecks,
    outcome: "blocked",
    note,
  };
}
