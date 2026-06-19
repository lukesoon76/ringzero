/**
 * The complete-mediation tool gateway (P4/P7/P8). EVERY tool call/write/dispatch
 * must pass through `mediate`/`execute` — there is no side-channel. Default-deny
 * pipeline:
 *   1. identity bound to a supervising user (unknown agent → deny)
 *   2. authority scope (required ⊆ granted — least privilege)
 *   3. dynamic least privilege from governed state + tier
 *   4. recognised action (a defined transition; else fail closed)
 *   5. kernel governance: guard loop consulted + trajectory constraints
 * Only on passing all five is a tool permitted; execution then applies δ.
 */

import {
  checkTrajectoryConstraints,
  defaultApprovalVerifier,
  delta,
  firstViolation,
  hasTransition,
  runGuardLoop,
  type Action,
  type ActionId,
  type ApprovalVerifier,
  type GovernedState,
  type Theta,
  type TransitionSystem,
} from "@ring-zero/kernel";
import { InMemoryEventSink, type EventSink } from "./events.js";
import type { IdentityRegistry } from "./identity.js";

export type ToolIntent = "read" | "retrieve" | "compute" | "write" | "dispatch";

export interface ToolRequest {
  readonly agentId: string;
  readonly capabilityId: string;
  readonly operation: string;
  readonly intent: ToolIntent;
  readonly requiredScopes: readonly string[];
  readonly actionId: ActionId;
}

export interface AuthzFlags {
  readonly identityKnown: boolean;
  readonly scopeSatisfied: boolean;
  readonly leastPrivilegeOk: boolean;
}

export interface MediationDecision {
  readonly permitted: boolean;
  readonly reason: string;
  readonly authz: AuthzFlags;
  readonly recognised: boolean;
  readonly constraintViolation?: string;
}

export interface GatewayDeps {
  readonly identities: IdentityRegistry;
  readonly approvalVerifier?: ApprovalVerifier;
  readonly sink?: EventSink;
}

export class Gateway {
  private readonly approvalVerifier: ApprovalVerifier;
  readonly sink: EventSink;

  constructor(
    private readonly W: TransitionSystem,
    private readonly deps: GatewayDeps,
  ) {
    this.approvalVerifier = deps.approvalVerifier ?? defaultApprovalVerifier;
    this.sink = deps.sink ?? new InMemoryEventSink();
  }

  mediate(state: GovernedState, theta: Theta, req: ToolRequest): MediationDecision {
    const denied = (reason: string, authz: AuthzFlags, recognised: boolean, cv?: string): MediationDecision => {
      this.sink.emit({ kind: "authz-deny", agentId: req.agentId, actionId: req.actionId, intent: req.intent, detail: reason });
      return { permitted: false, reason, authz, recognised, constraintViolation: cv };
    };
    const none: AuthzFlags = { identityKnown: false, scopeSatisfied: false, leastPrivilegeOk: false };

    // 1. identity
    const identity = this.deps.identities.lookup(req.agentId);
    if (!identity) return denied(`unknown agent: ${req.agentId}`, none, false);

    // 2. authority scope (least privilege)
    if (!this.deps.identities.hasScopes(req.agentId, req.requiredScopes)) {
      return denied(
        `out-of-scope: [${req.requiredScopes.join(", ")}] not granted to ${req.agentId}`,
        { identityKnown: true, scopeSatisfied: false, leastPrivilegeOk: false },
        false,
      );
    }

    // 3. dynamic least privilege from state + tier
    const lp = this.leastPrivilege(state, theta, req);
    if (!lp.ok) {
      return denied(
        `least-privilege denied: ${lp.reason}`,
        { identityKnown: true, scopeSatisfied: true, leastPrivilegeOk: false },
        false,
      );
    }
    const authzOk: AuthzFlags = { identityKnown: true, scopeSatisfied: true, leastPrivilegeOk: true };

    // 4. recognised action (defined transition; else fail closed)
    if (!hasTransition(this.W, state.node, req.actionId)) {
      return denied(`unrecognised/undefined transition: (${state.node}, ${req.actionId})`, authzOk, false);
    }

    // 5. kernel governance: consult the guard loop, then enforce trajectory constraints
    const action = this.actionFor(req);
    runGuardLoop(state, theta);
    const checks = checkTrajectoryConstraints({ state, action, theta, approvalVerifier: this.approvalVerifier });
    const violation = firstViolation(checks);
    if (violation) {
      return denied(
        `constraint: ${violation.constraint} — ${violation.detail}`,
        authzOk,
        true,
        `${violation.constraint}: ${violation.detail}`,
      );
    }

    this.sink.emit({ kind: "authz-permit", agentId: req.agentId, actionId: req.actionId, intent: req.intent, detail: "permitted" });
    return { permitted: true, reason: "permitted", authz: authzOk, recognised: true };
  }

  execute(
    state: GovernedState,
    theta: Theta,
    req: ToolRequest,
  ): { readonly decision: MediationDecision; readonly next?: GovernedState } {
    const decision = this.mediate(state, theta, req);
    if (!decision.permitted) return { decision };
    const result = delta(this.W, state, this.actionFor(req), theta);
    if (!result.next.ok) {
      return { decision: { ...decision, permitted: false, reason: `invalid next state: ${result.next.reason}` } };
    }
    this.sink.emit({ kind: "tool-executed", agentId: req.agentId, actionId: req.actionId, intent: req.intent, detail: `→ ${result.next.value.node}` });
    return { decision, next: result.next.value };
  }

  private actionFor(req: ToolRequest): Action {
    return { id: req.actionId, kind: "capability", intent: req.intent, capabilityId: req.capabilityId };
  }

  private leastPrivilege(state: GovernedState, theta: Theta, req: ToolRequest): { ok: boolean; reason: string } {
    if (req.intent === "write" && state.flags.sensitiveData) {
      return { ok: false, reason: "no write after sensitive-data flag" };
    }
    if (req.intent === "dispatch") {
      const auth = this.approvalVerifier.isAuthentic(state.flags.approvalRecord, state.node);
      if (!auth.authentic) return { ok: false, reason: `release needs authenticated sign-off (${auth.detail})` };
      if (theta.requireDualApproval && state.data["secondApproval"] !== true) {
        return { ok: false, reason: "tier requires dual approval (second approver missing)" };
      }
    }
    return { ok: true, reason: "ok" };
  }
}
