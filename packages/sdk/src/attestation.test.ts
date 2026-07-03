import { describe, expect, it } from "vitest";
import { toAttestation, toPortfolioCoverage } from "./attestation.js";
import { discoverAll } from "./connectors.js";

const agents = Object.fromEntries(discoverAll().map((a) => [a.id, a]));

describe("attestation as a projection of the inventory record", () => {
  it("attests a clause only when a DETERMINISTIC control covers it", () => {
    const att = toAttestation(agents["aws-bedrock:loan-underwriter"]!);
    const eu = att.frameworks.find((f) => f.framework === "eu-ai-act")!;
    // art14 (human approval) + art12 (log) are deterministic → attested
    expect(eu.clauses.find((c) => c.clause === "art14")?.status).toBe("attested");
    expect(eu.clauses.find((c) => c.clause === "art12")?.status).toBe("attested");
    // fairness is advisory-only → a gap
    const feat = att.frameworks.find((f) => f.framework === "mas-feat")!;
    expect(feat.clauses.find((c) => c.clause === "fairness")?.status).toBe("advisory-only");
    expect(att.gaps.some((g) => g.startsWith("mas-feat:fairness"))).toBe(true);
  });

  it("an observe-only agent's clauses are all gaps (only detective controls)", () => {
    const att = toAttestation(agents["sap:procurement"]!);
    expect(att.frameworks.every((f) => f.attested === 0)).toBe(true);
    expect(att.gaps.length).toBeGreaterThan(0);
  });

  it("a native-only refund approval does NOT attest EU AI Act Art. 14 (detective, not deterministic)", () => {
    const att = toAttestation(agents["sfdc:service-agent"]!);
    const eu = att.frameworks.find((f) => f.framework === "eu-ai-act")!;
    expect(eu.clauses.find((c) => c.clause === "art14")?.status).toBe("advisory-only");
  });

  it("aggregates coverage across the portfolio", () => {
    const cov = toPortfolioCoverage(discoverAll());
    expect(cov.length).toBeGreaterThan(0);
    for (const c of cov) {
      expect(c.coveragePct).toBeGreaterThanOrEqual(0);
      expect(c.coveragePct).toBeLessThanOrEqual(100);
    }
  });

  it("tool grants inventory the blast radius (scopes + egress)", () => {
    const dispatch = agents["aws-bedrock:loan-underwriter"]!.tools.find((t) => t.intent === "dispatch")!;
    expect(dispatch.egress).toBe(true);
    expect(dispatch.scopes).toContain("decision:write");
  });
});
