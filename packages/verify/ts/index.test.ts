import { makeState, type Theta } from "@ring-zero/kernel";
import { describe, expect, it } from "vitest";
import { createPythonVerifier } from "./index.js";

const theta: Theta = {
  tier: 3,
  thresholds: { Alignment: 0.8, Confidence: 0.7, Information: 0.5 },
  Lmax: 16,
  defaultContainment: "Escalate",
  requireDualApproval: false,
  verifierTimeoutMs: 1000,
};

const stateWith = (verifyDirective: unknown) =>
  makeState({
    node: "n",
    attrs: { Alignment: 1, Verified: 0, Length: 1, Information: 1, Confidence: 0 },
    data: { _verify: verifyDirective },
  });

const verifier = createPythonVerifier();

// Spawns `uv run python` — give it room on a cold cache.
describe("python verifier RPC bridge (REAL)", () => {
  it("catches the double-counted EBITDA (2.82 vs 1.82)", () => {
    const r = verifier.verify(
      stateWith({ checks: [{ kind: "numeric", label: "coverage", claimed: 2.82, recomputed: 1.82, tolerance: 0.01 }] }),
      theta,
    );
    expect(r.verified).toBe(0);
    expect(r.detail).toMatch(/mismatch|2\.82/);
  }, 30000);

  it("an LLM 'looks fine' advisory cannot pass a numerically wrong result", () => {
    const r = verifier.verify(
      stateWith({
        checks: [{ kind: "numeric", label: "coverage", claimed: 2.82, recomputed: 1.82, tolerance: 0.01 }],
        advisory: { llmVerdict: "looks fine", score: 0.99 },
      }),
      theta,
    );
    expect(r.verified).toBe(0);
  }, 30000);

  it("passes a correct, evidence-backed result", () => {
    const r = verifier.verify(
      stateWith({ checks: [{ kind: "numeric", label: "coverage", claimed: 1.82, recomputed: 1.82, tolerance: 0.01 }] }),
      theta,
    );
    expect(r.verified).toBe(1);
  }, 30000);
});
