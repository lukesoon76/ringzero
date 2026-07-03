import { describe, expect, it } from "vitest";
import { runEvalSuite } from "./eval-harness.js";

describe("assurance / red-team harness", () => {
  const report = runEvalSuite();

  it("covers every pipeline with clean, attack, governance-lever, and kill-switch cases", () => {
    expect(report.total).toBeGreaterThanOrEqual(12);
    for (const kind of ["clean", "attack", "governance-lever", "kill-switch"] as const) {
      expect(report.cases.some((c) => c.kind === kind)).toBe(true);
    }
  });

  it("all cases pass — attacks contained, clean runs released", () => {
    const failures = report.cases.filter((c) => !c.pass);
    expect(failures).toEqual([]);
    expect(report.passRate).toBe(100);
  });

  it("clean runs are expected to release; attacks are expected to be contained", () => {
    for (const c of report.cases) {
      if (c.kind === "clean") expect(c.expected).toBe("released");
      else expect(c.expected).toBe("contained");
    }
  });
});
