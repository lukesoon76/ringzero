import {
  delta,
  hasTransition,
  makeState,
  runGuardLoop,
  runTrajectory,
  UndefinedTransition,
  type Action,
} from "@ring-zero/kernel";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildCreditMemoPolicy, NODES } from "./credit-memo.js";
import { thetaForTier } from "./tiers.js";

const W = buildCreditMemoPolicy();
const theta = thetaForTier(3);
const allNodes = [...W.nodes];
const allActions = [...W.actions];

const arbAttrs = fc.record({
  Alignment: fc.double({ min: 0, max: 1, noNaN: true }),
  Verified: fc.constantFrom(0, 1),
  Length: fc.nat({ max: 30 }),
  Information: fc.double({ min: 0, max: 1, noNaN: true }),
  Confidence: fc.double({ min: 0, max: 1, noNaN: true }),
});

const fullData = {
  sourceAllowlisted: true,
  recencyMonths: 12,
  authenticatedApproval: true,
  _verify: { checks: [{ kind: "numeric", label: "x", claimed: 1, recomputed: 1, tolerance: 0.01 }] },
};

describe("kernel safety properties (fuzzed)", () => {
  it("δ never silently transitions on an undefined edge — it throws", () => {
    fc.assert(
      fc.property(fc.constantFrom(...allNodes), fc.constantFrom(...allActions), arbAttrs, (node, actionId, attrs) => {
        const state = makeState({ node, attrs });
        const action: Action = { id: actionId, kind: "capability", intent: "compute" };
        if (hasTransition(W, node, actionId)) {
          expect(() => delta(W, state, action, theta)).not.toThrow();
        } else {
          expect(() => delta(W, state, action, theta)).toThrow(UndefinedTransition);
        }
      }),
    );
  });

  it("the prohibited edge (drafted → release) can NEVER fire under any state", () => {
    fc.assert(
      fc.property(arbAttrs, (attrs) => {
        const state = makeState({ node: NODES.drafted, attrs });
        const release: Action = { id: "C4.release", kind: "capability", intent: "dispatch" };
        expect(() => delta(W, state, release, theta)).toThrow(UndefinedTransition);
      }),
    );
  });

  it("the guard loop is total and deterministic for any state", () => {
    fc.assert(
      fc.property(fc.constantFrom(...allNodes), arbAttrs, (node, attrs) => {
        const s = makeState({ node, attrs });
        const a = runGuardLoop(s, theta);
        const b = runGuardLoop(s, theta);
        expect(a).toEqual(b);
        expect(["continue", "remediate", "terminal"]).toContain(a.decision.kind);
      }),
    );
  });

  it("every run halts within the Lmax step budget at a terminal", () => {
    fc.assert(
      fc.property(arbAttrs, (attrs) => {
        const seed = makeState({ node: NODES.start, attrs, data: fullData });
        const t = runTrajectory(W, theta, seed);
        expect(t.steps.length).toBeLessThanOrEqual(theta.Lmax);
        expect(["Halt", "Escalate", "Abstain", "Complete"]).toContain(t.terminal.kind);
      }),
    );
  });
});
