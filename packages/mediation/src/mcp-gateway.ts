/**
 * Regent MCP gateway — the universal, orchestrator- and hyperscaler-agnostic
 * enforcement point. MCP (Model Context Protocol) is becoming the common
 * tool-call protocol, so a gateway that sits between ANY agent and its MCP tools
 * mediates every tool call deterministically, regardless of what built the agent.
 *
 * The decision is DETERMINISTIC and FAIL-CLOSED: an unknown tool, an ungranted
 * scope, or a deterministic guardrail hit (PII / secrets / jailbreak in the
 * arguments) blocks the call. Advisory guardrail signals are surfaced but never
 * decide the gate (hard constraint).
 */

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
}

export interface McpDecision {
  readonly permitted: boolean;
  readonly intent?: McpIntent;
  readonly reasons: readonly string[];
  readonly guardrail: GuardrailReport;
  readonly advisories: readonly string[];
}

export interface McpGatewayConfig {
  readonly bindings: readonly McpToolBinding[];
  readonly grantedScopes: readonly string[];
}

export class RegentMcpGateway {
  constructor(private readonly config: McpGatewayConfig) {}

  /** Mediate a single MCP tool call. Deterministic, fail-closed. */
  mediate(call: McpToolCall): McpDecision {
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
    return { permitted: true, intent: binding.intent, reasons: ["permitted — bound tool, scopes granted, no deterministic guardrail hit"], guardrail, advisories };
  }
}
