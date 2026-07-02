import { describe, expect, it } from "vitest";
import { listPipelines, runOrchestration } from "./orchestration.js";

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

describe("insurance-claims pipeline", () => {
  const opts = { pipeline: "insurance-claims" } as const;

  it("settles a clean claim at default governance levels", () => {
    const r = runOrchestration(opts);
    expect(r.pipeline).toBe("insurance-claims");
    expect(r.released).toBe(true);
    expect(r.agents.map((a) => a.id)).toEqual(["fnol", "policy", "fraud", "adjudication", "settlement"]);
    expect(r.agents.every((a) => a.status === "ok")).toBe(true);
  });

  it("blocks a lapsed policy structurally", () => {
    const r = runOrchestration({ ...opts, scenario: "lapsed-policy" });
    expect(r.released).toBe(false);
    expect(r.agents.find((a) => a.id === "policy")!.status).not.toBe("ok");
  });

  it("blocks an inflated claim via the deterministic verifier", () => {
    const r = runOrchestration({ ...opts, scenario: "inflated-claim" });
    expect(r.released).toBe(false);
    const fraud = r.agents.find((a) => a.id === "fraud")!;
    expect(fraud.status).not.toBe("ok");
    expect(fraud.cotAdvisory).toBe(true);
  });

  it("escalates settlement when its governance is raised to Tier 4", () => {
    const r = runOrchestration({ ...opts, tiers: { settlement: 4 } });
    expect(r.released).toBe(false);
    expect(r.agents.find((a) => a.id === "settlement")!.status).toBe("contained");
  });

  it("is fail-closed: killing the fraud agent contains settlement", () => {
    const r = runOrchestration({ ...opts, killed: ["fraud"] });
    const byId = Object.fromEntries(r.agents.map((a) => [a.id, a.status]));
    expect(byId.fraud).toBe("killed");
    expect(byId.adjudication).toBe("skipped");
    expect(byId.settlement).toBe("skipped");
    expect(r.released).toBe(false);
  });
});

describe("claims-fraud pipeline (fan-out / fan-in)", () => {
  const opts = { pipeline: "claims-fraud" } as const;

  it("passes a clean claim through all three checks to the consolidator", () => {
    const r = runOrchestration(opts);
    expect(r.released).toBe(true);
    expect(r.agents.map((a) => a.id)).toEqual(["extractor", "treatment", "duration", "noncoverable", "consolidator"]);
    expect(r.agents.every((a) => a.status === "ok")).toBe(true);
  });

  it("runs the three checks in parallel: killing one check does NOT skip the others", () => {
    const r = runOrchestration({ ...opts, killed: ["duration"] });
    const byId = Object.fromEntries(r.agents.map((a) => [a.id, a.status]));
    expect(byId.duration).toBe("killed");
    // siblings depend only on the extractor, so they still run
    expect(byId.treatment).toBe("ok");
    expect(byId.noncoverable).toBe("ok");
    // the consolidator depends on all three → contained
    expect(byId.consolidator).toBe("skipped");
    expect(r.released).toBe(false);
  });

  it("contains an inflated/fraudulent treatment cost via the verifier", () => {
    const r = runOrchestration({ ...opts, scenario: "inflated-treatment" });
    expect(r.released).toBe(false);
    const treatment = r.agents.find((a) => a.id === "treatment")!;
    expect(treatment.status).not.toBe("ok");
    // the other checks are unaffected and still run
    expect(r.agents.find((a) => a.id === "noncoverable")!.status).toBe("ok");
    expect(r.agents.find((a) => a.id === "consolidator")!.status).toBe("skipped");
  });

  it("blocks a stale policy of record structurally", () => {
    const r = runOrchestration({ ...opts, scenario: "stale-policy" });
    expect(r.agents.find((a) => a.id === "noncoverable")!.status).not.toBe("ok");
    expect(r.released).toBe(false);
  });
});

describe("pipeline manifest", () => {
  it("lists all verticals with scenarios and default tiers", () => {
    const m = listPipelines();
    const ids = m.map((p) => p.id);
    expect(ids).toContain("credit-memo");
    expect(ids).toContain("insurance-claims");
    expect(ids).toContain("claims-fraud");
    const ins = m.find((p) => p.id === "insurance-claims")!;
    expect(ins.scenarios.map((s) => s.id)).toContain("inflated-claim");
    expect(ins.agents.find((a) => a.id === "settlement")!.defaultTier).toBe(3);
  });

  it("emits a DAG topology with a knowledge-base node and reference edges", () => {
    const claims = listPipelines().find((p) => p.id === "claims-fraud")!;
    const kb = claims.nodes.find((n) => n.kind === "knowledge");
    expect(kb).toBeDefined();
    // extractor fans out to all three checks
    const fromExtractor = claims.edges.filter((e) => e.from === "extractor" && e.kind === "flow").map((e) => e.to);
    expect(fromExtractor.sort()).toEqual(["duration", "noncoverable", "treatment"]);
    // the three checks fan in to the consolidator
    const toConsolidator = claims.edges.filter((e) => e.to === "consolidator" && e.kind === "flow").map((e) => e.from);
    expect(toConsolidator.sort()).toEqual(["duration", "noncoverable", "treatment"]);
    // the knowledge base feeds the checks via reference edges
    expect(claims.edges.filter((e) => e.kind === "reference").length).toBe(3);
  });
});
