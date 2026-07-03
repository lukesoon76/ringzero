import { runWorkflowSpec } from "@ring-zero/policy";
import { describe, expect, it } from "vitest";
import { compileManifestToWorkflow } from "./compile-manifest.js";
import { CONNECTORS, discoverAll, discoverModels } from "./connectors.js";

describe("universal agent discovery", () => {
  it("discovers agents across every platform, normalised to one schema", () => {
    const all = discoverAll();
    const sources = new Set(all.map((m) => m.source));
    for (const c of CONNECTORS) expect(sources.has(c.source)).toBe(true);
    // every manifest carries the canonical fields
    for (const m of all) {
      expect(m.id && m.name && m.source).toBeTruthy();
      expect(["inline", "native", "observe"]).toContain(m.enforcement.mode);
    }
  });

  it("filters discovery by source", () => {
    const only = discoverAll(["aws-bedrock"]);
    expect(only.every((m) => m.source === "aws-bedrock")).toBe(true);
    expect(only.length).toBeGreaterThan(0);
  });

  it("labels which agents are bindable (inline) vs observe-only", () => {
    const all = discoverAll();
    expect(all.some((m) => m.enforcement.mode === "inline" && m.enforcement.bindable)).toBe(true);
    expect(all.some((m) => m.enforcement.mode === "observe" && !m.enforcement.bindable)).toBe(true);
  });

  it("carries MAS AI RG inventory metadata on every agent", () => {
    for (const m of discoverAll()) {
      expect(m.purpose).toBeTruthy();
      expect(Array.isArray(m.skills)).toBe(true);
      expect(Array.isArray(m.dataCategories)).toBe(true);
      expect(["intake", "development", "validation", "deployed", "retired"]).toContain(m.lifecycleStage);
      expect(m.materiality.tierRationale).toBeTruthy();
    }
  });

  it("discovers non-agentic models (classical-ML + foundation) for the inventory", () => {
    const models = discoverModels();
    expect(models.some((m) => m.kind === "classical-ml")).toBe(true);
    expect(models.some((m) => m.kind === "foundation" && m.thirdParty)).toBe(true);
    // models link back to the agents that use them
    expect(models.some((m) => m.usedByAgents.length > 0)).toBe(true);
  });

  it("compiles a discovered manifest to a governed workflow that the kernel runs", () => {
    const bedrock = discoverAll(["aws-bedrock"])[0]!;
    const w = compileManifestToWorkflow(bedrock);
    expect(w.states.find((s) => s.initial)).toBeTruthy();
    // Bedrock loan agent dispatches externally → the kernel contains it without an
    // authenticated approval, proving Regent governs the imported agent.
    const t = runWorkflowSpec(w);
    expect(t.terminal.kind).not.toBe("Complete");
  });
});
