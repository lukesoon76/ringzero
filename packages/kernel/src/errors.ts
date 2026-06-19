/**
 * Kernel error taxonomy. These represent fail-closed conditions on the binding
 * path — every one of them must terminate a trajectory in containment, never be
 * swallowed into a "continue".
 */

export type FailClosedReason =
  | { readonly kind: "unknown-state"; readonly detail: string }
  | { readonly kind: "missing-attribute"; readonly detail: string }
  | { readonly kind: "verifier-timeout"; readonly detail: string }
  | { readonly kind: "verifier-error"; readonly detail: string }
  | { readonly kind: "unrecognised-action"; readonly detail: string }
  | { readonly kind: "undefined-transition"; readonly detail: string }
  | { readonly kind: "constraint-violation"; readonly detail: string }
  | { readonly kind: "transition-guard-failed"; readonly detail: string }
  | { readonly kind: "no-action-available"; readonly detail: string };

/**
 * Thrown by δ when an action is applied to a (node, action) pair that has no
 * defined edge. This is the *structural* enforcement of "prohibited transitions
 * cannot be invoked" (decision D5): there is no code path that silently
 * transitions on an undefined edge.
 */
export class UndefinedTransition extends Error {
  override readonly name = "UndefinedTransition";
  constructor(
    readonly fromNode: string,
    readonly actionId: string,
  ) {
    super(`UndefinedTransition: no edge for (node=${fromNode}, action=${actionId})`);
  }
}

/** Raised when the policy DSL fails to compile to a well-formed transition system. */
export class PolicyCompileError extends Error {
  override readonly name = "PolicyCompileError";
  constructor(detail: string) {
    super(`PolicyCompileError: ${detail}`);
  }
}
