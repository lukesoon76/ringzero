import { describe, expect, it } from "vitest";
import { compileLangGraph, governLangGraph, type LangGraphSpec } from "./langgraph.js";

/**
 * A LangGraph-style agent: retrieve → analyze → approve → respond(tool/dispatch).
 * Regent governs the imported graph — the dispatch is blocked unless an
 * authenticated approval was minted for the prior node.
 */
const graph = (approve: boolean): LangGraphSpec => ({
  name: "lg-demo",
  entrypoint: "start",
  finish: "done",
  tier: 3,
  nodes: [
    { name: "retrieve", kind: "agent", intent: "retrieve", effectAttrs: { Alignment: 1, Information: 0.9 } },
    { name: "analyze", kind: "agent", intent: "compute", effectAttrs: { Verified: 1, Confidence: 0.9 } },
    ...(approve ? [{ name: "approved", intent: "control" as const, mintApproval: true }] : []),
    { name: "done", kind: "tool", intent: "dispatch" as const },
  ],
  edges: [
    { from: "start", to: "retrieve" },
    { from: "retrieve", to: "analyze" },
    ...(approve ? [{ from: "analyze", to: "approved" }, { from: "approved", to: "done" }] : [{ from: "analyze", to: "done" }]),
  ],
  seed: { attrs: { Alignment: 1, Verified: 1, Confidence: 1, Length: 0, Information: 0.9 } },
});

describe("LangGraph adapter", () => {
  it("compiles a LangGraph spec to a governed Regent workflow", () => {
    const w = compileLangGraph(graph(true));
    expect(w.states.find((s) => s.initial)?.id).toBe("start");
    expect(w.states.find((s) => s.terminal)?.id).toBe("done");
    // the approval node compiles to a control action that mints an approval
    const approveT = w.transitions.find((t) => t.to === "approved");
    expect(approveT?.action.intent).toBe("control");
  });

  it("governs the imported graph: dispatch is blocked without an authenticated approval", () => {
    const t = governLangGraph(graph(false));
    expect(t.terminal.kind).not.toBe("Complete"); // contained — no sign-off
  });

  it("governs the imported graph: dispatch proceeds once approval is minted", () => {
    const t = governLangGraph(graph(true));
    expect(t.terminal.kind).toBe("Complete");
  });
});
