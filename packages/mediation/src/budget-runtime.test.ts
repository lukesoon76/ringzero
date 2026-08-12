import { describe, expect, it } from "vitest";
import { BudgetInterceptor, DEMO_BUDGET_SESSION } from "./budget-runtime.js";

describe("BudgetInterceptor — token/cost runaway containment", () => {
  it("permits calls under the budget and accumulates the meter", () => {
    const b = new BudgetInterceptor({ tokenBudget: 100_000 });
    expect(b.mediate({ tool: "a", tokens: 40_000 }).outcome).toBe("permitted");
    expect(b.mediate({ tool: "b", tokens: 30_000 }).outcome).toBe("permitted");
    expect(b.consumedTokens).toBe(70_000);
  });

  it("contains the call that would breach the token budget (not the one that fits)", () => {
    const b = new BudgetInterceptor({ tokenBudget: 100_000 });
    b.mediate({ tool: "a", tokens: 70_000 });
    const d = b.mediate({ tool: "b", tokens: 40_000 }); // 110k > 100k
    expect(d.outcome).toBe("contained");
    expect(d.control).toBe("Token budget");
    expect(d.reason).toMatch(/110,000 would exceed the budget 100,000/);
    expect(b.consumedTokens).toBe(70_000); // breaching call did NOT accumulate
  });

  it("contains on a cost-budget breach with the exact figures", () => {
    const b = new BudgetInterceptor({ costBudgetUsd: 1 });
    b.mediate({ tool: "a", costUsd: 0.8 });
    const d = b.mediate({ tool: "b", costUsd: 0.5 });
    expect(d.outcome).toBe("contained");
    expect(d.control).toBe("Cost budget");
    expect(d.reason).toMatch(/\$1\.30 would exceed the budget \$1\.00/);
  });

  it("strict mode fails closed on a call with no meter under an active budget", () => {
    const strict = new BudgetInterceptor({ tokenBudget: 100_000, strict: true });
    expect(strict.mediate({ tool: "unmetered" }).outcome).toBe("contained");
    const lenient = new BudgetInterceptor({ tokenBudget: 100_000 });
    expect(lenient.mediate({ tool: "unmetered" }).outcome).toBe("permitted");
  });

  it("contains the recursive expand loop in the demo session at the budget", () => {
    const b = new BudgetInterceptor({ tokenBudget: 200_000, costBudgetUsd: 5 });
    const decisions = b.runSession(DEMO_BUDGET_SESSION);
    const contained = decisions.filter((d) => d.outcome === "contained");
    expect(contained).toHaveLength(1);
    expect(decisions[decisions.length - 1]!.outcome).toBe("contained"); // the 3rd expand is the runaway step
    expect(b.consumedTokens).toBeLessThanOrEqual(200_000);
  });
});
