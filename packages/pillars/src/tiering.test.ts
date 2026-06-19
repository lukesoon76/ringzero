import { describe, expect, it } from "vitest";
import { enforcementProfile, scoreToTier } from "./tiering.js";

describe("risk tiering → enforcement linkage (P2)", () => {
  it("maps a low-risk use case to Tier 1", () => {
    expect(scoreToTier({ agency: 0, authority: 1, impact: 0, exposure: 1, recoverability: 1 }).tier).toBe(1);
  });

  it("maps a high-risk use case (credit release) to Tier 4", () => {
    const a = scoreToTier({ agency: 3, authority: 3, impact: 3, exposure: 3, recoverability: 3 });
    expect(a.tier).toBe(4);
    expect(a.total).toBe(15);
  });

  it("changing tier visibly changes enforcement intensity", () => {
    const t1 = enforcementProfile(1);
    const t4 = enforcementProfile(4);
    expect(t1.dualApproval).toBe(false);
    expect(t4.dualApproval).toBe(true);
    expect(t4.containment).toBe("Escalate");
    expect(t4.alignmentThreshold).toBeGreaterThan(t1.alignmentThreshold);
    expect(t4.lengthBudget).toBeLessThan(t1.lengthBudget);
  });
});
