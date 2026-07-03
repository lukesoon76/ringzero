import { describe, expect, it } from "vitest";
import { buildAllTrustCards, buildTrustCard } from "./trust-card.js";

describe("trust card", () => {
  it("grades a pipeline A from real assurance evidence", () => {
    const card = buildTrustCard("credit-memo");
    expect(card.subject).toBe("Credit-Memo Pipeline");
    expect(card.evidence.assurancePassRate).toBe(100);
    expect(card.evidence.attacksContained).toBe(card.evidence.attacksTotal);
    expect(card.score).toBeGreaterThanOrEqual(90);
    expect(card.grade).toBe("A");
  });

  it("asserts the structural guarantees and maps core frameworks", () => {
    const card = buildTrustCard("claims-fraud");
    expect(card.guarantees).toEqual({ deterministicBindingPath: true, llmFree: true, failClosed: true, replayable: true });
    expect(card.frameworks.map((f) => f.shortName)).toContain("EU AI Act");
    expect(card.frameworks.map((f) => f.shortName)).toContain("MAS AI RG");
    expect(card.frameworks.length).toBe(6);
    expect(card.claims.some((c) => c.label === "Attacks contained")).toBe(true);
  });

  it("produces a card for every pipeline", () => {
    const all = buildAllTrustCards();
    expect(all.map((c) => c.pipeline).sort()).toEqual(["claims-fraud", "credit-memo", "insurance-claims"]);
  });

  it("rejects an unknown pipeline", () => {
    expect(() => buildTrustCard("nope")).toThrow(/unknown pipeline/);
  });
});
