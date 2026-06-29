import { describe, expect, it } from "vitest";
import { runOrchestration } from "./orchestration.js";

describe("multi-agent governed orchestration", () => {
  it("releases on a clean run at default governance levels", () => {
    const r = runOrchestration();
    expect(r.released).toBe(true);
    expect(r.haltedAt).toBeNull();
    expect(r.agents.every((a) => a.status === "ok")).toBe(true);
  });

  it("changing an agent's governance level on the fly changes what the kernel permits", () => {
    // Raising the Release agent to Tier 4 lifts θ_C to 0.8; its confidence (0.75)
    // no longer clears the bar, so it escalates instead of auto-dispatching.
    const r = runOrchestration({ tiers: { release: 4 } });
    expect(r.released).toBe(false);
    const release = r.agents.find((a) => a.id === "release")!;
    expect(release.status).toBe("contained");
    expect(release.terminalKind).toBe("Escalate");
    expect(release.theta.confidence).toBe(0.8);
  });

  it("is fail-closed: a killed agent contains everything downstream", () => {
    const r = runOrchestration({ killed: ["analysis"] });
    expect(r.released).toBe(false);
    expect(r.haltedAt).toBe("Analysis Agent");
    const byId = Object.fromEntries(r.agents.map((a) => [a.id, a]));
    expect(byId.intake!.status).toBe("ok");
    expect(byId.retrieval!.status).toBe("ok");
    expect(byId.analysis!.status).toBe("killed");
    expect(byId.drafting!.status).toBe("skipped");
    expect(byId.release!.status).toBe("skipped");
  });

  it("blocks structurally on stale data regardless of level", () => {
    const r = runOrchestration({ scenario: "stale-data" });
    expect(r.released).toBe(false);
    const retrieval = r.agents.find((a) => a.id === "retrieval")!;
    expect(retrieval.status).not.toBe("ok");
    expect(retrieval.rationale).toMatch(/recency/i);
  });

  it("blocks on a failed deterministic verification (double-counted EBITDA)", () => {
    const r = runOrchestration({ scenario: "double-count" });
    expect(r.released).toBe(false);
    const analysis = r.agents.find((a) => a.id === "analysis")!;
    expect(analysis.status).not.toBe("ok");
    // the agent's chain-of-thought is advisory only — never on the binding path
    expect(analysis.cotAdvisory).toBe(true);
  });

  it("derives rationale from real kernel guard evaluations", () => {
    const r = runOrchestration({ tiers: { analysis: 4 } });
    const analysis = r.agents.find((a) => a.id === "analysis")!;
    // at Tier 4, θ_C=0.8 > confidence 0.75 → low-confidence escalate
    expect(analysis.status).toBe("contained");
    expect(analysis.steps.length).toBeGreaterThan(0);
  });
});
