/**
 * Financial Runtime Controls — a deterministic, session-stateful interceptor for
 * agentic finance (the "SAFR" runtime checkpoint). It sits in the tool-call path
 * (alongside the MCP gateway) and, before any financial operation executes,
 * enforces THREE controls, fail-closed:
 *
 *   1. Financial scope boundary  — the operation must be within the agent's
 *      authorised mandate (allowlist by token/API auth). Off-mandate ⇒ blocked.
 *   2. Dynamic materiality        — the tool-call payload's amount / risk-profile
 *      change is rated Low/Medium/High/Critical; at/above the configured tier it
 *      requires an ACTIVE authenticated human-in-the-loop validation (the
 *      automation-bias barrier) or it is blocked.
 *   3. Cumulative session exposure — a running sum of executed exposure; if a call
 *      would push the session past the cap, the run is CONTAINED (halts runaway,
 *      non-deterministic loops from draining exposure a step at a time).
 *
 * All decisions are deterministic and cite the control + a framework clause, so
 * the block is auditable in the forensic replay. No LLM on this path.
 */

export type MaterialityRating = "low" | "medium" | "high" | "critical";
const ORDER: Record<MaterialityRating, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export interface FinancialToolCall {
  readonly tool: string;
  /** Financial operation, e.g. "Query_Balance", "Rebalance", "ACH_Transfer". */
  readonly operation: string;
  /** Transaction / exposure amount in base currency. */
  readonly amount?: number;
  /** Does this call change the client's risk profile? (bumps materiality to ≥ High.) */
  readonly riskProfileChange?: boolean;
}

export interface FinanceConfig {
  /** Operations within the agent's mandate (token/API-authorised). */
  readonly allowedOperations: readonly string[];
  /** Amount thresholds that define the materiality tiers. */
  readonly materiality: { readonly medium: number; readonly high: number; readonly critical: number };
  /** At or above this tier, an authenticated human validation is required. */
  readonly requireApprovalAtOrAbove: MaterialityRating;
  /** Max cumulative exposure permitted across one session before containment. */
  readonly sessionExposureCap: number;
}

export type FinanceOutcome = "permitted" | "blocked" | "contained";
export interface FinanceDecision {
  readonly call: FinancialToolCall;
  readonly outcome: FinanceOutcome;
  readonly materiality: MaterialityRating;
  readonly cumulativeExposure: number;
  readonly control: string;
  readonly clause: string;
  readonly reason: string;
}

export const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
  allowedOperations: ["Query_Balance", "Portfolio_View", "Rebalance", "ACH_Transfer_Internal"],
  materiality: { medium: 10_000, high: 100_000, critical: 1_000_000 },
  requireApprovalAtOrAbove: "critical",
  sessionExposureCap: 2_000_000,
};

export class FinanceRuntimeInterceptor {
  private cumulative = 0;
  constructor(private readonly cfg: FinanceConfig = DEFAULT_FINANCE_CONFIG) {}

  reset(): void {
    this.cumulative = 0;
  }
  get exposure(): number {
    return this.cumulative;
  }

  rate(call: FinancialToolCall): MaterialityRating {
    const amt = call.amount ?? 0;
    let r: MaterialityRating = amt >= this.cfg.materiality.critical ? "critical" : amt >= this.cfg.materiality.high ? "high" : amt >= this.cfg.materiality.medium ? "medium" : "low";
    if (call.riskProfileChange && ORDER[r] < ORDER.high) r = "high";
    return r;
  }

  /** Mediate one financial tool call. Deterministic, fail-closed. */
  mediate(call: FinancialToolCall, ctx: { approved?: boolean } = {}): FinanceDecision {
    const materiality = this.rate(call);
    const base = { call, materiality, cumulativeExposure: this.cumulative };

    // 1. scope boundary — must be within the authorised financial mandate
    if (!this.cfg.allowedOperations.includes(call.operation)) {
      return { ...base, outcome: "blocked", control: "Financial scope boundary", clause: "MAS SAFR — scoped financial mandate", reason: `operation "${call.operation}" is outside the authorised mandate` };
    }

    // 2. dynamic materiality → active human-in-the-loop validation barrier
    if (ORDER[materiality] >= ORDER[this.cfg.requireApprovalAtOrAbove] && !ctx.approved) {
      return { ...base, outcome: "blocked", control: "Materiality human-in-the-loop", clause: "MindForge / IMDA MGF — automation-bias control", reason: `Critical Materiality Event (${materiality}, ${fmt(call.amount)}) requires authenticated human validation` };
    }

    // 3. cumulative session exposure cap → contain runaway exposure
    const prospective = this.cumulative + (call.amount ?? 0);
    if (prospective > this.cfg.sessionExposureCap) {
      return { ...base, outcome: "contained", control: "Cumulative exposure interceptor", clause: "MAS SAFR / EU DORA — session exposure cap", reason: `session exposure ${fmt(prospective)} would exceed cap ${fmt(this.cfg.sessionExposureCap)}` };
    }

    this.cumulative = prospective;
    return { call, materiality, cumulativeExposure: this.cumulative, outcome: "permitted", control: "—", clause: "within mandate, materiality, and exposure limits", reason: "permitted" };
  }

  /** Run a whole session through the interceptor. `approveCritical` lifts the HITL barrier. */
  runSession(calls: readonly FinancialToolCall[], opts: { approveCritical?: boolean } = {}): FinanceDecision[] {
    this.reset();
    return calls.map((c) => this.mediate(c, { approved: opts.approveCritical }));
  }
}

function fmt(n?: number): string {
  return n === undefined ? "$0" : `$${n.toLocaleString("en-US")}`;
}

/** A representative wealth-advisory / payments session for the demo. */
export const DEMO_FINANCE_SESSION: readonly FinancialToolCall[] = [
  { tool: "balances", operation: "Query_Balance", amount: 0 },
  { tool: "advisor", operation: "Rebalance", amount: 45_000 },
  { tool: "payments", operation: "ACH_Transfer", amount: 250_000 }, // external ACH — OFF-MANDATE
  { tool: "advisor", operation: "Rebalance", amount: 1_800_000, riskProfileChange: true }, // Critical
  { tool: "advisor", operation: "Rebalance", amount: 900_000 }, // High; pushes cumulative over the cap once the 1.8M is approved
  { tool: "payments", operation: "ACH_Transfer_Internal", amount: 400_000 },
];
