import { describe, expect, it } from "vitest";
import { discoverAll, discoverModels } from "./connectors.js";
import { attestInventory, combineInventory, normaliseAgent, normaliseModel } from "./inventory-attestation.js";

const agents = discoverAll();
const models = discoverModels();
const byAgent = Object.fromEntries(agents.map((a) => [a.id, a]));
const byModel = Object.fromEntries(models.map((m) => [m.id, m]));

describe("estate inventory attestation (declared axis)", () => {
  const att = attestInventory([...agents.map(normaliseAgent), ...models.map(normaliseModel)]);

  it("covers agents + models in one matrix without a green wall", () => {
    expect(att.assetCount).toBe(agents.length + models.length);
    expect(att.coveragePct).toBeGreaterThan(0);
    expect(att.coveragePct).toBeLessThan(100);
    expect(att.gaps.length).toBeGreaterThan(0);
  });

  it("SAP Joule (observe-only) gaps the deterministic verifier and the event log", () => {
    const cells = att.matrix.filter((c) => c.asset === "sap:procurement");
    expect(cells.find((c) => c.controlId === "mas-deterministic-verification")?.status).toBe("gap");
    expect(cells.find((c) => c.controlId === "eu-ai-act-logging")?.status).toBe("gap");
  });

  it("the hero finance agent covers oversight + technical controls", () => {
    const cells = att.matrix.filter((c) => c.asset === "aws-bedrock:loan-underwriter");
    expect(cells.find((c) => c.controlId === "eu-ai-act-art14-oversight")?.status).toBe("covered");
    expect(cells.find((c) => c.controlId === "sg-mgf-technical-controls")?.status).toBe("covered");
  });

  it("surfaces the OVERDUE model validation as a gap, and a validated model as covered", () => {
    const gpt = att.matrix.filter((c) => c.asset === "model:gpt-4o");
    expect(gpt.find((c) => c.controlId === "sr-11-7-independent-validation")?.status).toBe("gap");
    const scorecard = att.matrix.filter((c) => c.asset === "model:credit-scorecard-v4");
    expect(scorecard.find((c) => c.controlId === "sr-11-7-independent-validation")?.status).toBe("covered");
  });

  it("marks vendor-managed drift as advisory, not a pass", () => {
    const gpt = att.matrix.find((c) => c.asset === "model:gpt-4o" && c.controlId === "mas-aimrm-ongoing-monitoring");
    expect(gpt?.status).toBe("advisory");
  });
});

describe("declared × exercised fusion", () => {
  const estate = combineInventory(agents, models);

  it("produces the four-way verdict across the estate", () => {
    expect(estate.verdicts.binding).toBeGreaterThan(0);
    expect(estate.verdicts.unverified).toBeGreaterThan(0);
    expect(estate.combined.length).toBe(estate.matrix.length);
  });

  it("a declared control not exercised by the compiled dry-run is 'unverified'", () => {
    // the loan agent DECLARES a deterministic verifier, but its thin compiled dry-run
    // (Verified seeded) never runs the verifier → declared ∧ ¬exercised = unverified
    const cell = estate.combined.find((c) => c.asset === "aws-bedrock:loan-underwriter" && c.controlId === "mas-deterministic-verification");
    expect(cell?.declared).toBe(true);
    expect(cell?.verdict).toBe("unverified");
  });

  it("a validated model is 'binding' for independent validation", () => {
    const cell = estate.combined.find((c) => c.asset === "model:credit-scorecard-v4" && c.controlId === "sr-11-7-independent-validation");
    expect(cell?.verdict).toBe("binding");
  });
});

it("model fixtures carry validation + recency state", () => {
  expect(byModel["model:gpt-4o"]!.validation?.status).toBe("overdue");
  expect(byModel["model:credit-scorecard-v4"]!.recency?.driftStatus).toBe("stable");
  expect(byAgent["aws-bedrock:loan-underwriter"]!.controls?.some((c) => c.kind === "verifier")).toBe(true);
});
