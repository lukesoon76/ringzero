import { runTrajectory } from "@ring-zero/kernel";
import { buildCreditMemoPolicy, seedHappyPath, thetaForTier } from "@ring-zero/policy";
import { describe, expect, it } from "vitest";
import { toOtlpTrace } from "./otel.js";

const trajectory = runTrajectory(buildCreditMemoPolicy(), thetaForTier(3), seedHappyPath);

describe("OTLP-shaped governance export", () => {
  const trace = toOtlpTrace(trajectory, "run-1");
  const scope = trace.resourceSpans[0]?.scopeSpans[0];

  it("emits one trace with one span per step", () => {
    expect(trace.resourceSpans).toHaveLength(1);
    expect(scope?.spans.length).toBe(trajectory.steps.length);
  });

  it("carries governance-semantic attributes and guard events", () => {
    const first = scope?.spans[0];
    const decision = first?.attributes.find((a) => a.key === "ring_zero.decision");
    expect(decision?.value.stringValue).toBeDefined();
    expect(first?.events.some((e) => e.name === "guard.evaluation")).toBe(true);
  });

  it("uses deterministic span ids (replay-safe)", () => {
    expect(scope?.spans[0]?.spanId).toBe("run-1-0");
  });
});
