/**
 * The labelled transition system W = (s0, S, Π, δ) and its two deterministic
 * selectors: forward action selection a(s,Θ) and intent-directed selection used
 * by guard-loop remediation.
 *
 * δ is the ONLY way to transition, and it THROWS `UndefinedTransition` for any
 * (node, action) pair without a defined edge — prohibited transitions are
 * therefore structurally impossible to invoke, not merely flagged (decision D5).
 */

import { UndefinedTransition } from "./errors.js";
import {
  validateState,
  type ActionId,
  type GovernedFlags,
  type GovernedState,
  type IntentClass,
  type NodeId,
  type RawAttributes,
  type Theta,
  type Validated,
} from "./model.js";

export interface Action {
  readonly id: ActionId; // unique label in Π
  readonly kind: "capability" | "control";
  readonly intent: IntentClass;
  readonly capabilityId?: string;
  readonly version?: string;
}

export interface StateUpdate {
  readonly attrs?: RawAttributes; // partial overrides; merged then re-validated
  readonly flags?: Partial<GovernedFlags>;
  readonly data?: Record<string, unknown>;
}

/**
 * Deterministic, pure transition effect. Must not read wall-clock time or
 * unseeded randomness (lint-enforced in this package).
 */
export type TransitionEffect = (state: GovernedState, theta: Theta) => StateUpdate;

export interface GuardCheck {
  readonly pass: boolean;
  readonly detail: string;
  readonly score?: number;
  readonly threshold?: number;
}

export interface TransitionGuard {
  readonly name: string;
  readonly check: (state: GovernedState, theta: Theta) => GuardCheck;
}

export interface Edge {
  readonly from: NodeId;
  readonly action: Action;
  readonly to: NodeId;
  readonly effect: TransitionEffect;
  readonly guard?: TransitionGuard;
  readonly priority: number; // lower = preferred during action selection
}

/** W = (s0, S, Π, δ). Frozen after compilation; there is no API to add edges. */
export interface TransitionSystem {
  readonly id: string;
  readonly s0: NodeId;
  readonly nodes: ReadonlySet<NodeId>;
  readonly actions: ReadonlySet<ActionId>; // Π (closed, enumerated)
  readonly edges: ReadonlyMap<string, Edge>; // key = edgeKey(from, actionId)
  readonly outgoing: ReadonlyMap<NodeId, readonly Edge[]>; // sorted by (priority, actionId)
  readonly terminals: ReadonlySet<NodeId>;
}

export function edgeKey(from: NodeId, action: ActionId): string {
  return `${from}::${action}`;
}

export interface Selection {
  readonly edge: Edge;
  readonly guard?: GuardCheck;
}

export function firstPassing(
  edges: readonly Edge[],
  state: GovernedState,
  theta: Theta,
): Selection | undefined {
  for (const edge of edges) {
    if (!edge.guard) return { edge };
    const guard = edge.guard.check(state, theta);
    if (guard.pass) return { edge, guard };
  }
  return undefined;
}

/**
 * a(s,Θ): deterministically select the next forward action from the outgoing
 * edges of the current node — lowest priority whose transition guard passes.
 * `undefined` means no action is available (the engine then fails closed).
 */
export function selectForwardAction(
  W: TransitionSystem,
  state: GovernedState,
  theta: Theta,
): Selection | undefined {
  return firstPassing(W.outgoing.get(state.node) ?? [], state, theta);
}

/** Intent-directed selection (used by guard-loop retrieve/verify remediation). */
export function selectByIntent(
  W: TransitionSystem,
  state: GovernedState,
  theta: Theta,
  intent: IntentClass,
): Selection | undefined {
  const edges = (W.outgoing.get(state.node) ?? []).filter((e) => e.action.intent === intent);
  return firstPassing(edges, state, theta);
}

export interface DeltaResult {
  readonly edge: Edge;
  readonly next: Validated<GovernedState>;
}

/**
 * δ: apply an action's edge effect to produce the next (validated) state.
 * Throws `UndefinedTransition` if no edge exists for (state.node, action.id).
 * The resulting state is re-validated; an invalid result makes the engine fail
 * closed rather than continuing on a malformed state.
 */
export function delta(
  W: TransitionSystem,
  state: GovernedState,
  action: Action,
  theta: Theta,
): DeltaResult {
  const edge = W.edges.get(edgeKey(state.node, action.id));
  if (!edge) throw new UndefinedTransition(state.node, action.id);

  const update = edge.effect(state, theta);
  const mergedAttrs: RawAttributes = { ...state.attrs, ...update.attrs };
  const mergedFlags: GovernedFlags = { ...state.flags, ...update.flags };
  const mergedData: Record<string, unknown> = { ...state.data, ...(update.data ?? {}) };

  const next = validateState({
    node: edge.to,
    attrs: mergedAttrs,
    flags: mergedFlags,
    data: mergedData,
  });
  return { edge, next };
}

/** True iff `(state.node, action)` has a defined edge — i.e. δ would not throw. */
export function hasTransition(W: TransitionSystem, from: NodeId, action: ActionId): boolean {
  return W.edges.has(edgeKey(from, action));
}
