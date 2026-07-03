/**
 * @ring-zero/sdk — the ONLY way the demo agent touches tools. Every intent is
 * routed through the mediation gateway; the agent holds no direct tool handles,
 * so there is no side-channel (complete mediation). The client owns the current
 * governed state and advances it only when the gateway permits.
 */

import type { GovernedState, Theta } from "@ring-zero/kernel";
import type { Gateway, MediationDecision, ToolIntent } from "@ring-zero/mediation";

export const PACKAGE = "@ring-zero/sdk";
export const STANCE = "THIN" as const;

export * from "./langgraph.js";
export * from "./manifest.js";
export * from "./connectors.js";
export * from "./compile-manifest.js";
export * from "./compliance.js";
export * from "./attestation.js";

export interface ToolInvocation {
  readonly capabilityId: string;
  readonly operation: string;
  readonly intent: ToolIntent;
  readonly requiredScopes: readonly string[];
  readonly actionId: string;
}

export interface RouteResult {
  readonly decision: MediationDecision;
  readonly applied: boolean;
  readonly state: GovernedState;
}

export class RegentClient {
  private state: GovernedState;

  constructor(
    private readonly agentId: string,
    private readonly gateway: Gateway,
    private readonly theta: Theta,
    initialState: GovernedState,
  ) {
    this.state = initialState;
  }

  current(): GovernedState {
    return this.state;
  }

  /** Route a tool intent through the gateway. Advances state iff permitted. */
  route(inv: ToolInvocation): RouteResult {
    const { decision, next } = this.gateway.execute(this.state, this.theta, {
      agentId: this.agentId,
      ...inv,
    });
    if (decision.permitted && next) {
      this.state = next;
      return { decision, applied: true, state: this.state };
    }
    return { decision, applied: false, state: this.state };
  }
}
