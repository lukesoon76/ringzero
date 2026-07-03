/**
 * LangGraph adapter — govern an EXISTING agent graph with Regent.
 *
 * A LangGraph-style `StateGraph` (nodes + edges + entrypoint) is compiled to a
 * Regent transition system W and run under the deterministic kernel, so the
 * imported graph inherits the whole binding path: guard loop, trajectory
 * constraints (e.g. no dispatch without an authenticated approval), verifiers,
 * and fail-closed containment. The adapter is DECLARATIVE — node intents/guards
 * map to vetted kernel primitives; no imported code runs on the binding path.
 *
 * This is the adoption wedge: "keep your LangGraph agent, govern it with Regent."
 */

import type { IntentClass, Trajectory } from "@ring-zero/kernel";
import { runWorkflowSpec, type GuardSpec, type WorkflowSpec } from "@ring-zero/policy";

export interface LangGraphNode {
  readonly name: string;
  /** "tool" nodes perform an external action; "agent" nodes reason/compute. */
  readonly kind?: "agent" | "tool";
  /** Governance intent for the action entering this node (defaults by kind). */
  readonly intent?: IntentClass;
  /** Optional declarative guard(s) on the edge entering this node. */
  readonly guard?: GuardSpec | readonly GuardSpec[];
  /** Mint an authenticated approval on entering this node (e.g. a human-approval node). */
  readonly mintApproval?: boolean;
  /** Attribute updates applied on entering this node. */
  readonly effectAttrs?: Record<string, number>;
}

export interface LangGraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface LangGraphSpec {
  readonly name?: string;
  readonly entrypoint: string;
  /** Node treated as terminal (defaults to any node with no outgoing edge, or "END"). */
  readonly finish?: string;
  readonly nodes: readonly LangGraphNode[];
  readonly edges: readonly LangGraphEdge[];
  readonly tier?: 1 | 2 | 3 | 4;
  readonly seed?: WorkflowSpec["seed"];
}

const END = "__end__";

function intentFor(node: LangGraphNode | undefined): IntentClass {
  if (node?.intent) return node.intent;
  return node?.kind === "tool" ? "dispatch" : "compute";
}

/** Compile a LangGraph spec to a governed Regent WorkflowSpec. */
export function compileLangGraph(g: LangGraphSpec): WorkflowSpec {
  if (!g.nodes?.length) throw new Error("LangGraph spec needs at least one node");
  const byName = new Map(g.nodes.map((n) => [n.name, n]));
  const hasOutgoing = new Set(g.edges.map((e) => e.from));
  const terminals = new Set<string>();
  if (g.finish) terminals.add(g.finish);
  for (const n of g.nodes) if (!hasOutgoing.has(n.name)) terminals.add(n.name);
  if (terminals.size === 0) terminals.add(END);

  const stateIds = new Set<string>([g.entrypoint, ...g.nodes.map((n) => n.name), ...terminals]);
  const states = [...stateIds].map((id) => ({
    id,
    initial: id === g.entrypoint,
    terminal: terminals.has(id),
  }));

  const transitions = g.edges.map((e) => {
    const target = byName.get(e.to);
    const effect = {
      ...(target?.effectAttrs ? { attrs: target.effectAttrs } : {}),
      ...(target?.mintApproval ? { flags: { mintApproval: true } } : {}),
    };
    return {
      from: e.from,
      to: e.to,
      action: { id: e.to, intent: intentFor(target), kind: target?.mintApproval ? ("control" as const) : ("capability" as const) },
      ...(target?.guard ? { guard: target.guard } : {}),
      ...(Object.keys(effect).length ? { effect } : {}),
    };
  });

  return {
    id: g.name ?? "langgraph",
    tier: g.tier ?? 3,
    states,
    transitions,
    seed: g.seed,
  };
}

/** Compile and run a LangGraph spec under Regent's deterministic governance. */
export function governLangGraph(g: LangGraphSpec): Trajectory {
  return runWorkflowSpec(compileLangGraph(g));
}
