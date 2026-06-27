import { describe, expect, it } from "vitest";
import { runWorkflowSpec, type WorkflowSpec } from "./workflow-spec.js";

function creditMemoSpec(overrides: { recencyMonths?: number; claimed?: number }): WorkflowSpec {
  return {
    id: "user-credit-memo",
    tier: 4,
    states: [
      { id: "start", initial: true },
      { id: "extracted" },
      { id: "retrieved" },
      { id: "drafted" },
      { id: "approved" },
      { id: "released", terminal: true },
    ],
    transitions: [
      { from: "start", to: "extracted", action: { id: "C1.extract", intent: "read" }, effect: { attrs: { Alignment: 0.5, Information: 0.6 } } },
      {
        from: "extracted",
        to: "retrieved",
        action: { id: "C2.retrieve", intent: "retrieve" },
        guard: [
          { type: "allowlist", field: "sourceAllowlisted" },
          { type: "recency", field: "recencyMonths", maxMonths: 18 },
        ],
        effect: { attrs: { Alignment: 1, Information: 0.9 } },
      },
      { from: "retrieved", to: "drafted", action: { id: "C4.draft", intent: "compute" }, effect: { data: { draft: "v1" } } },
      { from: "drafted", to: "approved", action: { id: "approve", intent: "control", kind: "control" }, effect: { flags: { mintApproval: true } } },
      { from: "approved", to: "released", action: { id: "C4.release", intent: "dispatch" }, effect: { data: { released: true } } },
    ],
    seed: {
      attrs: { Alignment: 0, Verified: 0, Length: 0, Information: 0, Confidence: 0 },
      data: {
        sourceAllowlisted: true,
        recencyMonths: overrides.recencyMonths ?? 12,
        _verify: { checks: [{ kind: "numeric", label: "coverage", claimed: overrides.claimed ?? 1.82, recomputed: 1.82, tolerance: 0.01 }] },
      },
    },
  };
}

describe("user workflow spec → governed run", () => {
  it("a well-formed workflow completes under governance", () => {
    const t = runWorkflowSpec(creditMemoSpec({}));
    expect(t.terminal.kind).toBe("Complete");
    expect(t.terminal.node).toBe("released");
  });

  it("stale data is blocked by the user-declared recency guard", () => {
    const t = runWorkflowSpec(creditMemoSpec({ recencyMonths: 26 }));
    expect(t.terminal.kind).toBe("Escalate");
    expect(t.steps.some((s) => s.action.id === "C4.release" && s.outcome === "applied")).toBe(false);
  });

  it("a wrong figure is caught by the kernel verifier", () => {
    const t = runWorkflowSpec(creditMemoSpec({ claimed: 2.82 }));
    expect(t.terminal.kind).toBe("Escalate");
  });

  it("rejects a malformed spec (duplicate transition)", () => {
    const bad = creditMemoSpec({});
    const dup: WorkflowSpec = { ...bad, transitions: [...bad.transitions, bad.transitions[1]!] };
    expect(() => runWorkflowSpec(dup)).toThrow();
  });
});
