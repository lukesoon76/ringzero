import { delta, makeState, runTrajectory, UndefinedTransition } from "@ring-zero/kernel";
import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  buildCreditMemoPolicy,
  NODES,
  seedDoubleCountedEbitda,
  seedHappyPath,
  seedStaleData,
  seedVerbalApproval,
} from "./credit-memo.js";
import { thetaForTier } from "./tiers.js";

const W = buildCreditMemoPolicy();
const theta = thetaForTier(3);

const usedRelease = (steps: ReturnType<typeof runTrajectory>["steps"]) =>
  steps.some((s) => s.action.id === "C4.release" && s.outcome === "applied");

describe("credit-memo — governed runs", () => {
  it("happy path → released / Complete (release only after authenticated approval)", () => {
    const t = runTrajectory(W, theta, seedHappyPath);
    expect(t.terminal.kind).toBe("Complete");
    expect(t.terminal.node).toBe(NODES.released);
    expect(usedRelease(t.steps)).toBe(true);
  });

  it("attack #1 — 26-month-stale data is blocked by the recency guard (Escalate)", () => {
    const t = runTrajectory(W, theta, seedStaleData);
    expect(t.terminal.kind).toBe("Escalate");
    expect(JSON.stringify(t.terminal)).toMatch(/recency/);
    expect(usedRelease(t.steps)).toBe(false);
  });

  it("attack #3 — double-counted EBITDA (2.82 vs 1.82) escalates with a discrepancy", () => {
    const t = runTrajectory(W, theta, seedDoubleCountedEbitda);
    expect(t.terminal.kind).toBe("Escalate");
    const verify = t.steps.find((s) => s.action.id === "verify");
    expect(verify?.verifyResult?.verified).toBe(0);
    expect(JSON.stringify(t.terminal)).toMatch(/2\.82/);
    expect(usedRelease(t.steps)).toBe(false);
  });

  it("attack #4 — a verbal 'approval confirmed' cannot authorise release (Escalate)", () => {
    const t = runTrajectory(W, theta, seedVerbalApproval);
    expect(t.terminal.kind).toBe("Escalate");
    expect(t.steps.some((s) => s.outcome === "blocked")).toBe(true);
    expect(JSON.stringify(t.terminal)).toMatch(/approval/);
    expect(usedRelease(t.steps)).toBe(false);
  });

  it("structural prohibition: release is impossible from the drafted node (δ throws)", () => {
    const drafted = makeState({
      node: NODES.drafted,
      attrs: { Alignment: 1, Verified: 1, Length: 3, Information: 1, Confidence: 1 },
    });
    expect(() => delta(W, drafted, ACTIONS.release, theta)).toThrow(UndefinedTransition);
  });

  it("replays bit-identically (no timestamps on the binding path)", () => {
    const a = runTrajectory(W, theta, seedHappyPath);
    const b = runTrajectory(W, theta, seedHappyPath);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("Tier 4 raises enforcement intensity (Escalate containment, stricter Θ)", () => {
    const t4 = thetaForTier(4);
    expect(t4.requireDualApproval).toBe(true);
    expect(t4.defaultContainment).toBe("Escalate");
    expect(t4.thresholds.Alignment).toBeGreaterThan(theta.thresholds.Alignment);
    // still completes the happy path under stricter Θ
    expect(runTrajectory(W, t4, seedHappyPath).terminal.kind).toBe("Complete");
  });
});
