import { describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, RED_LINES, RED_LINE_BY_ID, enforcementForAutonomy } from "./autonomy.js";

describe("L1–L5 autonomy framework", () => {
  it("defines exactly five levels L1..L5 in order", () => {
    expect(AUTONOMY_LEVELS.map((d) => d.level)).toEqual([1, 2, 3, 4, 5]);
    expect(AUTONOMY_LEVELS.map((d) => d.code)).toEqual(["L1", "L2", "L3", "L4", "L5"]);
  });

  it("makes safeguards monotonically stricter with autonomy", () => {
    for (let i = 1; i < AUTONOMY_LEVELS.length; i++) {
      const prev = AUTONOMY_LEVELS[i - 1]!;
      const cur = AUTONOMY_LEVELS[i]!;
      expect(cur.minTier).toBeGreaterThanOrEqual(prev.minTier);
      expect(cur.requiredControls.length).toBeGreaterThanOrEqual(prev.requiredControls.length);
      expect(cur.requiredCapabilities.length).toBeGreaterThanOrEqual(prev.requiredCapabilities.length);
      expect(cur.requiredRedLines.length).toBeGreaterThanOrEqual(prev.requiredRedLines.length);
    }
  });

  it("requires containment, sign-off, and a budget cap only once autonomy is high (L4+)", () => {
    expect(enforcementForAutonomy(3).requiredControls).not.toContain("containment");
    expect(enforcementForAutonomy(4).requiredControls).toContain("containment");
    expect(enforcementForAutonomy(4).requiredRedLines).toContain("RL-RELEASE-SIGNOFF");
    expect(enforcementForAutonomy(3).requiredCapabilities).not.toContain("budget-cap");
    expect(enforcementForAutonomy(4).requiredCapabilities).toContain("budget-cap");
    expect(enforcementForAutonomy(5).requiredCapabilities).toContain("budget-cap");
    expect(enforcementForAutonomy(5).minTier).toBe(4);
  });
});

describe("red lines", () => {
  it("every required red line resolves to a real catalogued mechanism", () => {
    for (const def of AUTONOMY_LEVELS) {
      for (const id of def.requiredRedLines) {
        expect(RED_LINE_BY_ID[id]).toBeDefined();
        expect(RED_LINE_BY_ID[id].enforcedBy.length).toBeGreaterThan(0);
      }
    }
  });

  it("the enumerated-actions red line is STRUCTURAL (impossible), not a runtime check", () => {
    const rl = RED_LINES.find((r) => r.id === "RL-ENUMERATED-ACTIONS")!;
    expect(rl.mechanism).toBe("structural");
    expect(rl.enforcedBy).toMatch(/δ|Undefined/);
  });
});
