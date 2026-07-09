import { describe, expect, it } from "vitest";
import { compileGraphToPipeline, runCustomGraph, type CustomGraph } from "./orchestration.js";

/** start → agent → validator → tool(dispatch) → end, with a knowledge sidecar into the validator. */
const GRAPH: CustomGraph = {
  id: "__custom_test__",
  label: "Test custom workflow",
  nodes: [
    { id: "s", kind: "start", label: "Start" },
    { id: "a", kind: "agent", label: "Reasoner", tier: 3 },
    { id: "v", kind: "validator", label: "Coverage check", tier: 3 },
    { id: "kb", kind: "knowledge", label: "Policy docs" },
    { id: "t", kind: "tool", label: "Release", tier: 3 },
    { id: "e", kind: "end", label: "End" },
  ],
  edges: [
    { from: "s", to: "a" },
    { from: "a", to: "v" },
    { from: "kb", to: "v" },
    { from: "v", to: "t" },
    { from: "t", to: "e" },
  ],
};

describe("custom-graph compilation + governed run", () => {
  it("compiles only executable nodes, topologically ordered, with a knowledge base", () => {
    const p = compileGraphToPipeline(GRAPH);
    expect(p.agents.map((a) => a.id)).toEqual(["a", "v", "t"]); // start/end/knowledge are not agents
    expect(p.knowledgeBase?.id).toBe("kb");
    expect(p.agents.find((a) => a.id === "v")?.readsKnowledge).toBe(true);
    // dependency order preserved
    expect(p.agents.find((a) => a.id === "v")?.dependsOn).toEqual(["a"]);
    expect(p.agents.find((a) => a.id === "a")?.dependsOn).toEqual([]);
  });

  it("runs through the real kernel and releases on a clean pass", () => {
    const r = runCustomGraph(GRAPH);
    expect(r.agents.map((a) => a.status)).toEqual(["ok", "ok", "ok"]);
    expect(r.released).toBe(true);
    // the validator's deterministic verifier actually fired
    const v = r.agents.find((a) => a.id === "v")!;
    expect(v.steps.some((s) => s.outcome === "verified")).toBe(true);
  });

  it("raising the agent to Tier 4 escalates it and contains everything downstream (fail-closed)", () => {
    const r = runCustomGraph(GRAPH, { tiers: { a: 4 } });
    const a = r.agents.find((x) => x.id === "a")!;
    expect(a.status).toBe("contained"); // Confidence 0.75 < Tier-4 bar 0.8 → escalate
    expect(r.agents.find((x) => x.id === "v")!.status).toBe("skipped");
    expect(r.agents.find((x) => x.id === "t")!.status).toBe("skipped");
    expect(r.released).toBe(false);
  });

  it("a bare tool dispatch is a governed dispatch — it mints an approval, so it is not blocked", () => {
    const solo: CustomGraph = {
      id: "__solo__",
      label: "solo",
      nodes: [
        { id: "t", kind: "tool", label: "Send", tier: 3 },
        { id: "e", kind: "end", label: "End" },
      ],
      edges: [{ from: "t", to: "e" }],
    };
    const r = runCustomGraph(solo);
    expect(r.agents.find((a) => a.id === "t")?.status).toBe("ok");
  });
});
