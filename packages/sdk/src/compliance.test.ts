import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { describe, expect, it } from "vitest";
import { evaluateAgent, JURISDICTIONS, worstStatus } from "./compliance.js";
import { discoverAll } from "./connectors.js";

const byId = Object.fromEntries(FRAMEWORK_LIBRARY.map((f) => [f.id, f]));
const agents = Object.fromEntries(discoverAll().map((a) => [a.id, a]));

describe("compliance mesh engine", () => {
  it("breach depends on the framework: SAP Joule (observe-only, can write) breaches MGF but only gaps under MAS AI RG", () => {
    const sap = agents["sap:procurement"]!;
    // Singapore MGF marks technical-controls + accountability CRITICAL → breach
    const mgf = evaluateAgent(sap, [byId["sg-mgf"]!]);
    expect(mgf.status).toBe("breach");
    expect(mgf.counts.breach).toBeGreaterThan(0);
    // MAS AI RG marks the same failing controls "high" → gaps, not breach
    const masrg = evaluateAgent(sap, [byId["mas-ai-rg"]!]);
    expect(masrg.status).toBe("gaps");
  });

  it("passes a governed, inline-bindable agent more cleanly than an observe-only one", () => {
    const bedrock = evaluateAgent(agents["aws-bedrock:loan-underwriter"]!, [byId["eu-ai-act"]!]);
    const sap = evaluateAgent(agents["sap:procurement"]!, [byId["eu-ai-act"]!]);
    expect(bedrock.score).toBeGreaterThan(sap.score);
  });

  it("flags shadow AI (unowned, unassessed) as breaching the inventory/materiality controls", () => {
    const shadow = evaluateAgent(agents["otel:unattributed-egress"]!, [byId["mas-ai-rg"]!]);
    expect(shadow.status).toBe("breach");
    expect(shadow.results.some((r) => r.requirementId === "inventory" && r.status === "breach")).toBe(true);
  });

  it("meshes multiple frameworks into one posture", () => {
    const meshed = evaluateAgent(agents["sfdc:service-agent"]!, [byId["eu-ai-act"]!, byId["mas-ai-rg"]!, byId["sg-mgf"]!]);
    expect(meshed.results.length).toBeGreaterThan(10);
    expect(["compliant", "gaps", "breach"]).toContain(meshed.status);
  });

  it("marks fairness/transparency requirements as manual (never auto-passed)", () => {
    const res = evaluateAgent(agents["azure:claims-triage"]!, [byId["mas-feat"]!]);
    expect(res.results.some((r) => r.status === "manual")).toBe(true);
  });

  it("compares posture across jurisdictions", () => {
    const agent = agents["sap:procurement"]!;
    const perJ = JURISDICTIONS.map((j) => evaluateAgent(agent, j.frameworks.map((id) => byId[id]!).filter(Boolean)).status);
    // an observe-only agent that can write should not be uniformly compliant everywhere
    expect(worstStatus(perJ)).toBe("breach");
  });
});
