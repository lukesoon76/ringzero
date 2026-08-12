import { describe, expect, it } from "vitest";
import { attestAutonomy, checkAgentAutonomy } from "./autonomy-check.js";
import { discoverAll } from "./connectors.js";

const agents = discoverAll();
const by = Object.fromEntries(agents.map((a) => [a.id, a]));

describe("agent autonomy conformance", () => {
  it("the fully-governed L4 loan underwriter conforms (verifier + oversight + containment + budget-cap, deterministic)", () => {
    const r = checkAgentAutonomy(by["aws-bedrock:loan-underwriter"]!);
    expect(r.level).toBe(4);
    expect(r.conforms).toBe(true);
    expect(r.severity).toBe("ok");
    // the budget cap is a required L4 capability and is met here
    expect(r.controls.find((c) => c.kind === "budget-cap")?.met).toBe(true);
  });

  it("a high-autonomy agent with only advisory/detective controls is CRITICAL (under-governed, incl. missing budget cap)", () => {
    const sfdc = checkAgentAutonomy(by["sfdc:service-agent"]!); // L4, detective approval only, no budget cap
    expect(sfdc.level).toBe(4);
    expect(sfdc.conforms).toBe(false);
    expect(sfdc.severity).toBe("critical");
    expect(sfdc.gaps.join(" ")).toMatch(/verifier|containment/);
    expect(sfdc.gaps.join(" ")).toMatch(/budget-cap/);
    expect(sfdc.controls.find((c) => c.kind === "budget-cap")?.met).toBe(false);

    const sap = checkAgentAutonomy(by["sap:procurement"]!); // L4, observe-only
    expect(sap.severity).toBe("critical");
  });

  it("an L3 agent missing a deterministic human-oversight control is a watch-level gap", () => {
    const r = checkAgentAutonomy(by["azure:claims-triage"]!); // L3, verifier but no oversight
    expect(r.level).toBe(3);
    expect(r.conforms).toBe(false);
    expect(r.severity).toBe("watch");
    expect(r.gaps.join(" ")).toMatch(/human-oversight/);
  });

  it("an unclassified externally-dispatching agent is critical and reports the classification gap", () => {
    const r = checkAgentAutonomy(by["otel:unattributed-egress"]!);
    expect(r.level).toBeNull();
    expect(r.code).toBe("unclassified");
    expect(r.gaps[0]).toMatch(/not classified/);
  });

  it("the estate report surfaces conformance, criticals and unclassified counts", () => {
    const rep = attestAutonomy(agents);
    expect(rep.summary.total).toBe(agents.length);
    expect(rep.summary.critical).toBeGreaterThan(0);
    expect(rep.summary.conforming).toBeGreaterThan(0);
    expect(rep.summary.conforming).toBeLessThan(rep.summary.total); // honest: not a green wall
    expect(rep.levels).toHaveLength(5);
    expect(rep.redLines.length).toBeGreaterThan(0);
  });
});
