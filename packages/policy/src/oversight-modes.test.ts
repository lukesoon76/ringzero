import { describe, expect, it } from "vitest";
import { OVERSIGHT_MODES, oversightMode, oversightModeForAutonomy } from "./oversight-modes.js";

describe("human oversight modes", () => {
  it("defines the full spectrum in/on/over/out of the loop", () => {
    expect(OVERSIGHT_MODES.map((m) => m.id)).toEqual(["hitl", "hotl", "hic", "autonomous"]);
    for (const m of OVERSIGHT_MODES) {
      expect(m.enforcement.length).toBeGreaterThan(0);
      expect(m.euAiActArt14).toMatch(/Art\. 14/);
      expect(m.autonomyLevels.length).toBeGreaterThan(0);
    }
  });

  it("shifts the human from IN the loop to ON/OVER it as autonomy rises", () => {
    expect(oversightModeForAutonomy(1)).toBe("hitl");
    expect(oversightModeForAutonomy(2)).toBe("hitl");
    expect(oversightModeForAutonomy(3)).toBe("hotl");
    expect(oversightModeForAutonomy(4)).toBe("hotl");
    expect(oversightModeForAutonomy(5)).toBe("hic");
  });

  it("the highest-oversight mode gates before each action; the lowest relies on structural red lines", () => {
    expect(oversightMode("hitl").latency).toBe("before each action");
    expect(oversightMode("autonomous").enforcement).toMatch(/structural|δ total|red lines/);
  });
});
