import { describe, expect, it } from "vitest";
import { runGuardLoop } from "./guards.js";
import { makeState, type RawAttributes, type Theta } from "./model.js";

const theta: Theta = {
  tier: 3,
  thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
  Lmax: 16,
  defaultContainment: "Escalate",
  requireDualApproval: false,
  verifierTimeoutMs: 1000,
};

const st = (attrs: RawAttributes) => makeState({ node: "n", attrs });

describe("fixed-priority guard loop", () => {
  it("halts when the length budget is exhausted (highest priority)", () => {
    const r = runGuardLoop(st({ Alignment: 0, Verified: 0, Length: 16, Information: 0, Confidence: 0 }), theta);
    expect(r.decision).toMatchObject({ kind: "terminal", terminal: "Halt" });
  });

  it("prefers retrieve on low alignment over verify", () => {
    const r = runGuardLoop(st({ Alignment: 0.1, Verified: 0, Length: 0, Information: 0, Confidence: 0 }), theta);
    expect(r.decision).toEqual({ kind: "remediate", remediation: "retrieve" });
  });

  it("verifies when aligned but unverified", () => {
    const r = runGuardLoop(st({ Alignment: 1, Verified: 0, Length: 0, Information: 1, Confidence: 0 }), theta);
    expect(r.decision).toEqual({ kind: "remediate", remediation: "verify" });
  });

  it("escalates on low confidence once verified", () => {
    const r = runGuardLoop(st({ Alignment: 1, Verified: 1, Length: 0, Information: 1, Confidence: 0.2 }), theta);
    expect(r.decision).toMatchObject({ kind: "terminal", terminal: "Escalate" });
  });

  it("continues when verified, confident and in budget", () => {
    const r = runGuardLoop(st({ Alignment: 1, Verified: 1, Length: 0, Information: 1, Confidence: 0.9 }), theta);
    expect(r.decision).toEqual({ kind: "continue" });
  });

  it("is deterministic", () => {
    const s = st({ Alignment: 0.5, Verified: 0, Length: 2, Information: 0.4, Confidence: 0.5 });
    expect(runGuardLoop(s, theta)).toEqual(runGuardLoop(s, theta));
  });
});
