/**
 * The policy authoring DSL → labelled transition system W compiler (decision D2).
 *
 * The "undefined transitions structurally impossible" guarantee (D5) is realised
 * here: compile() rejects a duplicate (from, action) pair (so δ is a genuine
 * function), validates that every edge endpoint is a declared node, and returns
 * a frozen W with no API to add edges afterwards. Combined with δ throwing on
 * any (node, action) without an edge, prohibited transitions cannot be invoked.
 */

import {
  PolicyCompileError,
  edgeKey,
  type Action,
  type ActionId,
  type Edge,
  type NodeId,
  type TransitionEffect,
  type TransitionGuard,
  type TransitionSystem,
} from "@ring-zero/kernel";

export interface TransitionSpec {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly action: Action;
  readonly effect: TransitionEffect;
  readonly guard?: TransitionGuard;
  readonly priority?: number;
}

export interface StateOptions {
  readonly initial?: boolean;
  readonly terminal?: boolean;
}

export class PolicyBuilder {
  private readonly nodes = new Set<NodeId>();
  private readonly terminals = new Set<NodeId>();
  private readonly specs: TransitionSpec[] = [];
  private initialNode: NodeId | undefined;

  constructor(readonly id: string) {}

  state(id: NodeId, opts: StateOptions = {}): this {
    this.nodes.add(id);
    if (opts.initial) {
      if (this.initialNode && this.initialNode !== id) {
        throw new PolicyCompileError(`multiple initial states: ${this.initialNode} and ${id}`);
      }
      this.initialNode = id;
    }
    if (opts.terminal) this.terminals.add(id);
    return this;
  }

  transition(spec: TransitionSpec): this {
    this.specs.push(spec);
    return this;
  }

  compile(): TransitionSystem {
    if (!this.initialNode) throw new PolicyCompileError("no initial state declared");

    const edges = new Map<string, Edge>();
    const actions = new Set<ActionId>();
    const outgoingDraft = new Map<NodeId, Edge[]>();

    for (const spec of this.specs) {
      if (!this.nodes.has(spec.from)) {
        throw new PolicyCompileError(`edge from undeclared node: ${spec.from}`);
      }
      if (!this.nodes.has(spec.to)) {
        throw new PolicyCompileError(`edge to undeclared node: ${spec.to}`);
      }
      const key = edgeKey(spec.from, spec.action.id);
      if (edges.has(key)) {
        throw new PolicyCompileError(
          `non-deterministic δ: duplicate edge (from=${spec.from}, action=${spec.action.id})`,
        );
      }
      const edge: Edge = {
        from: spec.from,
        to: spec.to,
        action: spec.action,
        effect: spec.effect,
        guard: spec.guard,
        priority: spec.priority ?? 0,
      };
      edges.set(key, edge);
      actions.add(spec.action.id);
      const list = outgoingDraft.get(spec.from) ?? [];
      list.push(edge);
      outgoingDraft.set(spec.from, list);
    }

    const outgoing = new Map<NodeId, readonly Edge[]>();
    for (const [node, list] of outgoingDraft) {
      const sorted = [...list].sort(
        (a, b) =>
          a.priority - b.priority ||
          (a.action.id < b.action.id ? -1 : a.action.id > b.action.id ? 1 : 0),
      );
      outgoing.set(node, Object.freeze(sorted));
    }

    return Object.freeze({
      id: this.id,
      s0: this.initialNode,
      nodes: new Set(this.nodes),
      actions,
      edges,
      outgoing,
      terminals: new Set(this.terminals),
    });
  }
}

export function definePolicy(id: string): PolicyBuilder {
  return new PolicyBuilder(id);
}

/** Build a capability action label for Π. */
export function capabilityAction(
  capabilityId: string,
  operation: string,
  intent: Action["intent"],
  version = "1.0.0",
): Action {
  return { id: `${capabilityId}.${operation}`, kind: "capability", intent, capabilityId, version };
}

/** Build a control action label for Π (e.g. human approval). */
export function controlAction(id: string, intent: Action["intent"] = "control"): Action {
  return { id, kind: "control", intent };
}
