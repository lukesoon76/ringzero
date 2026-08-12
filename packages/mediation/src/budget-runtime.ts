/**
 * Cost / Token Budget — a deterministic, session-stateful interceptor that caps
 * the cumulative tokens and monetary cost a run may consume, and CONTAINS the
 * trajectory before the call that would breach the cap.
 *
 * This is the runtime answer to runaway / recursively-self-improving agent loops:
 * a non-deterministic loop cannot drain budget a step at a time past the ceiling —
 * the (N)th call that would cross the line is contained, deterministically, with
 * the exact figures cited for the forensic replay. No LLM on this path.
 *
 * Optional `strict` metering makes it fail-closed on UNKNOWN cost too: while a
 * budget is active, a call that declares no token/cost meter is contained rather
 * than waved through (you cannot govern spend you refuse to measure).
 */

export interface BudgetConfig {
  /** Max cumulative tokens across one session/run. Omit to not cap tokens. */
  readonly tokenBudget?: number;
  /** Max cumulative USD across one session/run. Omit to not cap cost. */
  readonly costBudgetUsd?: number;
  /** Fail-closed on unknown: contain a call that declares no meter while a budget is active. */
  readonly strict?: boolean;
}

export interface MeteredCall {
  readonly tool: string;
  readonly operation?: string;
  /** Tokens this call will consume. */
  readonly tokens?: number;
  /** USD this call will cost. */
  readonly costUsd?: number;
}

export type BudgetOutcome = "permitted" | "contained";
export interface BudgetDecision {
  readonly call: MeteredCall;
  readonly outcome: BudgetOutcome;
  readonly cumulativeTokens: number;
  readonly cumulativeCostUsd: number;
  readonly tokenBudget?: number;
  readonly costBudgetUsd?: number;
  readonly control: string;
  readonly clause: string;
  readonly reason: string;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = { tokenBudget: 200_000, costBudgetUsd: 5 };

const CLAUSE = "resource-exhaustion / runaway-loop containment";

export class BudgetInterceptor {
  private tokens = 0;
  private cost = 0;
  constructor(private readonly cfg: BudgetConfig = DEFAULT_BUDGET_CONFIG) {}

  reset(): void {
    this.tokens = 0;
    this.cost = 0;
  }
  get consumedTokens(): number {
    return this.tokens;
  }
  get consumedCostUsd(): number {
    return this.cost;
  }

  /** Mediate one metered call. Deterministic, fail-closed on breach (and, in strict mode, on unknown cost). */
  mediate(call: MeteredCall): BudgetDecision {
    const hasTokenBudget = this.cfg.tokenBudget !== undefined;
    const hasCostBudget = this.cfg.costBudgetUsd !== undefined;
    const base = {
      call,
      cumulativeTokens: this.tokens,
      cumulativeCostUsd: this.cost,
      tokenBudget: this.cfg.tokenBudget,
      costBudgetUsd: this.cfg.costBudgetUsd,
    };

    // fail-closed on unknown (strict): can't govern spend you won't measure.
    if (this.cfg.strict && (hasTokenBudget || hasCostBudget) && call.tokens === undefined && call.costUsd === undefined) {
      return { ...base, outcome: "contained", control: "Budget meter", clause: CLAUSE, reason: `call "${call.tool}" declares no token/cost meter — cannot verify against the budget (fail-closed)` };
    }

    const prospectiveTokens = this.tokens + (call.tokens ?? 0);
    const prospectiveCost = this.cost + (call.costUsd ?? 0);

    if (hasTokenBudget && prospectiveTokens > this.cfg.tokenBudget!) {
      return { ...base, outcome: "contained", control: "Token budget", clause: CLAUSE, reason: `cumulative tokens ${prospectiveTokens.toLocaleString("en-US")} would exceed the budget ${this.cfg.tokenBudget!.toLocaleString("en-US")}` };
    }
    if (hasCostBudget && prospectiveCost > this.cfg.costBudgetUsd!) {
      return { ...base, outcome: "contained", control: "Cost budget", clause: CLAUSE, reason: `cumulative cost $${prospectiveCost.toFixed(2)} would exceed the budget $${this.cfg.costBudgetUsd!.toFixed(2)}` };
    }

    this.tokens = prospectiveTokens;
    this.cost = prospectiveCost;
    return { ...base, cumulativeTokens: this.tokens, cumulativeCostUsd: this.cost, outcome: "permitted", control: "—", clause: "within token and cost budget", reason: "permitted" };
  }

  /** Run a whole session; returns the per-call decisions (state resets first). */
  runSession(calls: readonly MeteredCall[]): BudgetDecision[] {
    this.reset();
    return calls.map((c) => this.mediate(c));
  }
}

/** A representative research-agent session with a recursive expand loop that a 200k-token budget contains. */
export const DEMO_BUDGET_SESSION: readonly MeteredCall[] = [
  { tool: "search", operation: "web.search", tokens: 8_000, costUsd: 0.08 },
  { tool: "summarize", operation: "llm.summarize", tokens: 40_000, costUsd: 0.4 },
  { tool: "expand", operation: "llm.expand", tokens: 60_000, costUsd: 0.6 },
  { tool: "expand", operation: "llm.expand", tokens: 60_000, costUsd: 0.6 }, // cumulative 168k
  { tool: "expand", operation: "llm.expand", tokens: 60_000, costUsd: 0.6 }, // → 228k > 200k: CONTAINED (runaway loop)
];
