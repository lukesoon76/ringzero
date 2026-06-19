import { runTrajectory } from "@ring-zero/kernel";
import { buildCreditMemoPolicy, seedHappyPath, thetaForTier } from "@ring-zero/policy";
import { TelemetryStore, type ReconstructedRun } from "@ring-zero/telemetry";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateAttestation } from "./attestation.js";
import { renderAttestationHtml } from "./render.js";

const dir = mkdtempSync(join(tmpdir(), "rz-attest-"));
const store = new TelemetryStore(join(dir, "a.db"));
store.recordRun(runTrajectory(buildCreditMemoPolicy(), thetaForTier(3), seedHappyPath), {
  runId: "run-happy",
  agentId: "memo-agent",
  governed: true,
});
const reconstructed = store.loadRun("run-happy");

afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("attestation export (P6)", () => {
  const att = generateAttestation(reconstructed, "credit-memo (U3)");

  it("resolves each satisfied control to a real trace event", () => {
    expect(att.controls.some((c) => c.satisfied)).toBe(true);
    for (const c of att.controls) {
      if (c.satisfied) {
        expect(c.evidence).toBeDefined();
        expect(reconstructed.steps[c.evidence!.stepIndex]).toBeDefined();
      }
    }
  });

  it("maps controls to EU AI Act, MAS and Singapore MGF", () => {
    const standards = att.controls.map((c) => c.standard).join(" | ");
    expect(standards).toMatch(/EU AI Act/);
    expect(standards).toMatch(/MAS/);
    expect(standards).toMatch(/Singapore MGF/);
  });

  it("reports gaps (never asserts satisfied) when evidence is absent", () => {
    const attrs = { Alignment: 1, Verified: 1 as const, Length: 0, Information: 1, Confidence: 1 };
    const bare: ReconstructedRun = {
      runId: "bare",
      agentId: "a",
      governed: true,
      tier: 1,
      policyId: "p",
      terminal: { kind: "Complete", detail: "" },
      steps: [
        {
          index: 0,
          fromNode: "s0",
          toNode: "s1",
          action: { id: "C1.extract", intent: "read", kind: "capability" },
          decision: "continue",
          outcome: "applied",
          preAttrs: attrs,
          postAttrs: attrs,
          guards: [{ guard: "length-budget", outcome: "passed", score: null, threshold: null, advisory: false }],
          note: null,
        },
      ],
    };
    const gappy = generateAttestation(bare, "no-oversight run");
    expect(gappy.gaps.length).toBeGreaterThan(0);
    expect(gappy.controls.find((c) => c.controlId === "eu-ai-act-art14-oversight")?.satisfied).toBe(false);
  });

  it("renders auditor HTML with replayable evidence links", () => {
    const html = renderAttestationHtml(att, { traceViewerBase: "/trace" });
    expect(html).toContain("Ring Zero");
    expect(html).toMatch(/run=run-happy&step=\d+/);
  });
});
