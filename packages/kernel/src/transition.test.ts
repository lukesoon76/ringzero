import { describe, expect, it } from "vitest";
import { UndefinedTransition } from "./errors.js";
import { makeState, type Theta } from "./model.js";
import { delta, edgeKey, hasTransition, type Action, type Edge, type TransitionSystem } from "./transition.js";

const theta: Theta = {
  tier: 3,
  thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
  Lmax: 16,
  defaultContainment: "Escalate",
  requireDualApproval: false,
  verifierTimeoutMs: 1000,
};

const go: Action = { id: "go", kind: "capability", intent: "compute" };
const edge: Edge = {
  from: "a",
  to: "b",
  action: go,
  effect: () => ({ attrs: { Confidence: 1 } }),
  priority: 0,
};
const W: TransitionSystem = {
  id: "tiny",
  s0: "a",
  nodes: new Set(["a", "b"]),
  actions: new Set(["go"]),
  edges: new Map([[edgeKey("a", "go"), edge]]),
  outgoing: new Map([["a", [edge]]]),
  terminals: new Set(["b"]),
};

const sa = makeState({
  node: "a",
  attrs: { Alignment: 1, Verified: 1, Length: 0, Information: 1, Confidence: 0.5 },
});

describe("δ (the transition function)", () => {
  it("applies a defined edge and re-validates the next state", () => {
    const r = delta(W, sa, go, theta);
    expect(r.next.ok).toBe(true);
    if (r.next.ok) {
      expect(r.next.value.node).toBe("b");
      expect(r.next.value.attrs.Confidence).toBe(1);
    }
  });

  it("THROWS UndefinedTransition for an undefined (node, action)", () => {
    const nope: Action = { id: "nope", kind: "capability", intent: "compute" };
    expect(() => delta(W, sa, nope, theta)).toThrow(UndefinedTransition);
  });

  it("hasTransition reflects exactly the defined edge set", () => {
    expect(hasTransition(W, "a", "go")).toBe(true);
    expect(hasTransition(W, "a", "nope")).toBe(false);
    expect(hasTransition(W, "b", "go")).toBe(false);
  });
});
