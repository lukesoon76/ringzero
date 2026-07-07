/**
 * Regent MCP gateway — the universal, orchestrator- and hyperscaler-agnostic
 * enforcement point. MCP (Model Context Protocol) is becoming the common
 * tool-call protocol, so a gateway that sits between ANY agent and its MCP tools
 * mediates every tool call deterministically, regardless of what built the agent.
 *
 * The decision is DETERMINISTIC and FAIL-CLOSED: an unknown tool, an ungranted
 * scope, a deterministic guardrail hit (PII / secrets / jailbreak in the
 * arguments), OR a financial-runtime violation (off-mandate op, unapproved
 * Critical materiality, or a breached cumulative session-exposure cap) blocks the
 * call. Advisory guardrail signals are surfaced but never decide the gate.
 */

import { FinanceRuntimeInterceptor, type FinanceConfig, type FinanceDecision } from "./finance-runtime.js";
import { runGuardrails, type GuardrailReport } from "./guardrails.js";

export type McpIntent = "read" | "retrieve" | "compute" | "write" | "dispatch";

export interface McpToolBinding {
  readonly tool: string;
  readonly intent: McpIntent;
  readonly requiredScopes: readonly string[];
}

export interface McpToolCall {
  readonly server: string;
  readonly tool: string;
  readonly args: unknown;
  /** Financial semantics — when `operation` is present the finance interceptor runs. */
  readonly operation?: string;
  readonly amount?: number;
  readonly riskProfileChange?: boolean;
}

export interface McpDecision {
  readonly permitted: boolean;
  readonly intent?: McpIntent;
  readonly reasons: readonly string[];
  readonly guardrail: GuardrailReport;
  readonly advisories: readonly string[];
  /** Present when the call carried financial semantics and the interceptor ran. */
  readonly finance?: FinanceDecision;
}

export interface McpGatewayConfig {
  readonly bindings: readonly McpToolBinding[];
  readonly grantedScopes: readonly string[];
  /** When set, financial operations additionally run the Financial Runtime Interceptor. */
  readonly finance?: FinanceConfig;
}

export class RegentMcpGateway {
  private readonly finance?: FinanceRuntimeInterceptor;

  constructor(private readonly config: McpGatewayConfig) {
    if (config.finance) this.finance = new FinanceRuntimeInterceptor(config.finance);
  }

  /** Reset the session-scoped state (cumulative financial exposure). */
  resetSession(): void {
    this.finance?.reset();
  }

  /** Mediate a single MCP tool call. Deterministic, fail-closed. */
  mediate(call: McpToolCall, ctx: { approved?: boolean } = {}): McpDecision {
    const binding = this.config.bindings.find((b) => b.tool === call.tool);
    const text = typeof call.args === "string" ? call.args : JSON.stringify(call.args ?? "");
    const guardrail = runGuardrails(text);
    const advisories = guardrail.advisories.map((a) => `${a.label} (${a.score})`);

    // (1) unknown tool → fail closed (complete mediation, default-deny)
    if (!binding) {
      return { permitted: false, reasons: [`unknown tool "${call.tool}" — default-deny, fail-closed`], guardrail, advisories };
    }
    // (2) deterministic guardrail hit → block (advisory never blocks)
    if (guardrail.blocked) {
      return { permitted: false, intent: binding.intent, reasons: [`guardrail blocked: ${guardrail.blockedBy.join(", ")}`], guardrail, advisories };
    }
    // (3) least privilege — every required scope must be granted
    const missing = binding.requiredScopes.filter((s) => !this.config.grantedScopes.includes(s));
    if (missing.length) {
      return { permitted: false, intent: binding.intent, reasons: [`scope not granted: ${missing.join(", ")}`], guardrail, advisories };
    }
    // (4) financial runtime controls (scope mandate, materiality HITL, exposure cap)
    if (this.finance && call.operation !== undefined) {
      const finance = this.finance.mediate(
        { tool: call.tool, operation: call.operation, amount: call.amount, riskProfileChange: call.riskProfileChange },
        { approved: ctx.approved },
      );
      if (finance.outcome !== "permitted") {
        return { permitted: false, intent: binding.intent, reasons: [`${finance.control}: ${finance.reason}`], guardrail, advisories, finance };
      }
      return { permitted: true, intent: binding.intent, reasons: ["permitted — within mandate, materiality, and exposure limits"], guardrail, advisories, finance };
    }

    return { permitted: true, intent: binding.intent, reasons: ["permitted — bound tool, scopes granted, no deterministic guardrail hit"], guardrail, advisories };
  }
}
