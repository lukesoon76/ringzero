import { describe, expect, it } from "vitest";
import type { GovernedState, Theta } from "./model.js";
import { defaultVerifier } from "./verifier.js";

const state = (verify: unknown): GovernedState => ({ data: { _verify: verify } } as unknown as GovernedState);
const theta = {} as Theta;

describe("default deterministic verifier — grounding / provenance check", () => {
  it("passes when every cited source is in the retrieved allowlist", () => {
    const r = defaultVerifier.verify(state({ checks: [{ kind: "grounding", label: "memo", cited: ["doc:A", "doc:B"], allowed: ["doc:A", "doc:B", "doc:C"] }] }), theta);
    expect(r.verified).toBe(1);
  });

  it("fails closed on a fabricated citation (source not retrieved)", () => {
    const r = defaultVerifier.verify(state({ checks: [{ kind: "grounding", label: "memo", cited: ["doc:A", "doc:FAKE"], allowed: ["doc:A", "doc:B"] }] }), theta);
    expect(r.verified).toBe(0);
    expect(r.detail).toMatch(/ungrounded citation.*doc:FAKE/);
  });

  it("a grounding failure is final even alongside a passing numeric check", () => {
    const r = defaultVerifier.verify(
      state({ checks: [
        { kind: "numeric", label: "coverage", claimed: 1.82, recomputed: 1.82, tolerance: 0.01 },
        { kind: "grounding", label: "sources", cited: ["hallucinated-source"], allowed: ["real-source"] },
      ] }),
      theta,
    );
    expect(r.verified).toBe(0);
  });
});
