/**
 * Bring-your-own workflow: a declarative (JSON) spec that compiles to a kernel
 * transition system W and runs under the SAME deterministic governance as the
 * built-in credit-memo policy. This is what the console Workbench posts.
 *
 * Guards and effects are DECLARATIVE (no user code on the binding path) — they
 * map to vetted kernel primitives, so an untrusted spec can never inject logic
 * into the guard engine. Verification uses the kernel's default verifier reading
 * `seed.data._verify`; approval authenticity is minted by the kernel.
 */

import {
  makeState,
  mintApproval,
  runTrajectory,
  type ApprovalRecord,
  type GovernedFlags,
  type GovernedState,
  type IntentClass,
  type RawAttributes,
  type Theta,
  type Trajectory,
  type TransitionEffect,
  type TransitionGuard,
  type TransitionSystem,
} from "@ring-zero/kernel";
import { definePolicy } from "./dsl.js";
import { thetaForTier } from "./tiers.js";

type AttrName = "Alignment" | "Verified" | "Length" | "Information" | "Confidence";

export type GuardSpec =
  | { readonly type: "allowlist"; readonly field: string }
  | { readonly type: "recency"; readonly field: string; readonly maxMonths: number }
  | { readonly type: "attrAtLeast"; readonly attr: AttrName; readonly value: number };

export interface EffectSpec {
  readonly attrs?: Partial<RawAttributes>;
  readonly flags?: { readonly sensitiveData?: boolean; readonly mintApproval?: boolean };
  readonly data?: Record<string, unknown>;
}

export interface TransitionSpecJSON {
  readonly from: string;
  readonly to: string;
  readonly action: { readonly id: string; readonly intent: IntentClass; readonly kind?: "capability" | "control" };
  readonly guard?: GuardSpec | readonly GuardSpec[];
  readonly effect?: EffectSpec;
  readonly priority?: number;
}

export interface WorkflowSpec {
  readonly id: string;
  readonly tier?: 1 | 2 | 3 | 4;
  readonly states: ReadonlyArray<{ readonly id: string; readonly initial?: boolean; readonly terminal?: boolean }>;
  readonly transitions: readonly TransitionSpecJSON[];
  readonly seed?: {
    readonly attrs?: Partial<RawAttributes>;
    readonly flags?: { readonly sensitiveData?: boolean };
    readonly data?: Record<string, unknown>;
  };
}

function compileOneGuard(spec: GuardSpec): TransitionGuard {
  switch (spec.type) {
    case "allowlist":
      return {
        name: `allowlist:${spec.field}`,
        check: (s) => ({ pass: s.data[spec.field] === true, detail: `${spec.field}=${String(s.data[spec.field])}` }),
      };
    case "recency":
      return {
        name: `recency:${spec.field}`,
        check: (s) => {
          const raw = s.data[spec.field];
          const n = typeof raw === "number" ? raw : Number.POSITIVE_INFINITY;
          return {
            pass: n <= spec.maxMonths,
            detail: `${spec.field}=${Number.isFinite(n) ? n : "missing"} (max ${spec.maxMonths})`,
            score: Number.isFinite(n) ? n : undefined,
            threshold: spec.maxMonths,
          };
        },
      };
    case "attrAtLeast":
      return {
        name: `attrAtLeast:${spec.attr}`,
        check: (s) => {
          const v = s.attrs[spec.attr];
          return { pass: v >= spec.value, detail: `${spec.attr}=${v} ≥ ${spec.value}`, score: v, threshold: spec.value };
        },
      };
    default:
      throw new Error(`unknown guard type: ${JSON.stringify(spec)}`);
  }
}

function compileGuard(spec: GuardSpec | readonly GuardSpec[] | undefined): TransitionGuard | undefined {
  if (!spec) return undefined;
  const list = Array.isArray(spec) ? spec : [spec as GuardSpec];
  if (list.length === 1) return compileOneGuard(list[0]!);
  const guards = list.map(compileOneGuard);
  return {
    name: `all(${list.map((g) => g.type).join(",")})`,
    check: (s, t) => {
      for (const g of guards) {
        const r = g.check(s, t);
        if (!r.pass) return r;
      }
      return { pass: true, detail: "all guards passed" };
    },
  };
}

function compileEffect(effect: EffectSpec | undefined, toNode: string): TransitionEffect {
  return () => {
    const update: { attrs?: RawAttributes; flags?: Partial<GovernedFlags>; data?: Record<string, unknown> } = {};
    if (effect?.attrs) update.attrs = effect.attrs;
    if (effect?.data) update.data = effect.data;
    if (effect?.flags) {
      const flags: { sensitiveData?: boolean; approvalRecord?: ApprovalRecord } = {};
      if (typeof effect.flags.sensitiveData === "boolean") flags.sensitiveData = effect.flags.sensitiveData;
      if (effect.flags.mintApproval) {
        flags.approvalRecord = mintApproval({ id: "wf-appr", approver: "workbench-approver", subjectNode: toNode });
      }
      update.flags = flags;
    }
    return update;
  };
}

export interface CompiledWorkflow {
  readonly W: TransitionSystem;
  readonly theta: Theta;
  readonly seed: GovernedState;
}

export function compileWorkflowSpec(spec: WorkflowSpec): CompiledWorkflow {
  if (!spec || typeof spec !== "object") throw new Error("workflow spec must be an object");
  if (!Array.isArray(spec.states) || spec.states.length === 0) throw new Error("workflow needs at least one state");
  if (!Array.isArray(spec.transitions)) throw new Error("workflow needs a transitions array");

  const builder = definePolicy(spec.id || "workflow");
  for (const st of spec.states) {
    builder.state(st.id, { initial: st.initial === true, terminal: st.terminal === true });
  }
  for (const t of spec.transitions) {
    builder.transition({
      from: t.from,
      to: t.to,
      action: { id: t.action.id, kind: t.action.kind ?? "capability", intent: t.action.intent },
      guard: compileGuard(t.guard),
      effect: compileEffect(t.effect, t.to),
      priority: t.priority ?? 0,
    });
  }
  const W = builder.compile();

  const attrs: RawAttributes = {
    Alignment: 0,
    Verified: 0,
    Length: 0,
    Information: 0,
    Confidence: 0,
    ...spec.seed?.attrs,
  };
  const seed = makeState({
    node: W.s0,
    attrs,
    flags: { sensitiveData: spec.seed?.flags?.sensitiveData ?? false },
    data: spec.seed?.data ?? {},
  });

  return { W, theta: thetaForTier(spec.tier ?? 3), seed };
}

/** Compile and run a user-supplied workflow under deterministic governance. */
export function runWorkflowSpec(spec: WorkflowSpec): Trajectory {
  const { W, theta, seed } = compileWorkflowSpec(spec);
  return runTrajectory(W, theta, seed);
}
