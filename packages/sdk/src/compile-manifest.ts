/**
 * Normalise → govern: compile a canonical AgentManifest (from ANY connector) to a
 * Regent transition system, so a discovered AWS/Azure/Salesforce/SAP/LangGraph
 * agent runs under the SAME deterministic kernel as a built-in pipeline.
 */

import type { GovernanceLevel, WorkflowSpec } from "@ring-zero/policy";
import type { AgentManifest, ManifestNode } from "./manifest.js";

function tierFromRisk(m: AgentManifest): GovernanceLevel {
  const s = m.riskSignals;
  const total = [s.agency, s.authority, s.impact, s.exposure, s.recoverability]
    .map((x) => Math.max(0, Math.min(3, Math.round(x))))
    .reduce((a, b) => a + b, 0);
  return total <= 3 ? 1 : total <= 7 ? 2 : total <= 11 ? 3 : 4;
}

const intentFor = (n: ManifestNode | undefined) => (n?.kind === "tool" ? "dispatch" : "compute");

/** Compile a manifest to a governed WorkflowSpec (agent/tool nodes become the trajectory). */
export function compileManifestToWorkflow(m: AgentManifest): WorkflowSpec {
  const steps = m.nodes.filter((n) => n.kind === "agent" || n.kind === "tool");
  const ids = new Set(steps.map((n) => n.id));
  const edges = m.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const byId = new Map(steps.map((n) => [n.id, n]));

  const hasIncoming = new Set(edges.map((e) => e.to));
  const hasOutgoing = new Set(edges.map((e) => e.from));
  const entry = steps.find((n) => !hasIncoming.has(n.id))?.id ?? steps[0]?.id ?? "start";

  const states = steps.length
    ? steps.map((n) => ({ id: n.id, initial: n.id === entry, terminal: !hasOutgoing.has(n.id) }))
    : [{ id: "start", initial: true, terminal: true }];

  const transitions = edges.map((e) => ({
    from: e.from,
    to: e.to,
    action: { id: e.to, intent: intentFor(byId.get(e.to)) as "compute" | "dispatch" },
  }));

  return {
    id: m.id,
    tier: tierFromRisk(m),
    states,
    transitions,
    seed: { attrs: { Alignment: 1, Verified: 1, Confidence: 1, Length: 0, Information: 0.9 } },
  };
}
