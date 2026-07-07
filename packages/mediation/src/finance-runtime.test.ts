import { describe, expect, it } from "vitest";
import { DEFAULT_FINANCE_CONFIG, DEMO_FINANCE_SESSION, FinanceRuntimeInterceptor } from "./finance-runtime.js";

describe("financial runtime controls (SAFR)", () => {
  it("blocks an off-mandate operation (financial scope boundary)", () => {
    const gw = new FinanceRuntimeInterceptor();
    const d = gw.mediate({ tool: "payments", operation: "ACH_Transfer", amount: 250_000 });
    expect(d.outcome).toBe("blocked");
    expect(d.control).toBe("Financial scope boundary");
  });

  it("rates materiality from the payload amount and risk-profile change", () => {
    const gw = new FinanceRuntimeInterceptor();
    expect(gw.rate({ tool: "a", operation: "Rebalance", amount: 5_000 })).toBe("low");
    expect(gw.rate({ tool: "a", operation: "Rebalance", amount: 45_000 })).toBe("medium");
    expect(gw.rate({ tool: "a", operation: "Rebalance", amount: 250_000 })).toBe("high");
    expect(gw.rate({ tool: "a", operation: "Rebalance", amount: 2_000_000 })).toBe("critical");
    // a risk-profile change bumps a low amount to at least High
    expect(gw.rate({ tool: "a", operation: "Rebalance", amount: 1_000, riskProfileChange: true })).toBe("high");
  });

  it("blocks a Critical Materiality Event without authenticated human validation", () => {
    const gw = new FinanceRuntimeInterceptor();
    const call = { tool: "advisor", operation: "Rebalance", amount: 1_800_000, riskProfileChange: true };
    expect(gw.mediate(call).outcome).toBe("blocked");
    // with an authenticated approval the barrier lifts
    expect(gw.mediate(call, { approved: true }).outcome).toBe("permitted");
  });

  it("contains the run when cumulative session exposure exceeds the cap", () => {
    const gw = new FinanceRuntimeInterceptor();
    gw.mediate({ tool: "advisor", operation: "Rebalance", amount: 1_800_000, riskProfileChange: true }, { approved: true }); // exposure 1.8M
    const d = gw.mediate({ tool: "advisor", operation: "Rebalance", amount: 900_000 }); // 2.7M > 2M cap
    expect(d.outcome).toBe("contained");
    expect(d.control).toBe("Cumulative exposure interceptor");
    // exposure did not advance past the cap
    expect(gw.exposure).toBe(1_800_000);
  });

  it("runs the demo session — approval flips Critical from blocked to permitted then exposure contains", () => {
    const gw = new FinanceRuntimeInterceptor();
    const denied = gw.runSession(DEMO_FINANCE_SESSION, { approveCritical: false });
    // off-mandate ACH blocked; Critical rebalance blocked (no approval)
    expect(denied.find((d) => d.call.operation === "ACH_Transfer")!.outcome).toBe("blocked");
    expect(denied.filter((d) => d.materiality === "critical").every((d) => d.outcome === "blocked")).toBe(true);

    const approved = gw.runSession(DEMO_FINANCE_SESSION, { approveCritical: true });
    // Critical now permitted, but a later call breaches the cumulative cap → contained
    expect(approved.some((d) => d.materiality === "critical" && d.outcome === "permitted")).toBe(true);
    expect(approved.some((d) => d.outcome === "contained")).toBe(true);
  });

  it("keeps the default config finance-safe (external ACH not in mandate)", () => {
    expect(DEFAULT_FINANCE_CONFIG.allowedOperations).not.toContain("ACH_Transfer");
    expect(DEFAULT_FINANCE_CONFIG.allowedOperations).toContain("ACH_Transfer_Internal");
  });
});
