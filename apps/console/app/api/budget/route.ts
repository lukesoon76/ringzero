import { BudgetInterceptor, DEFAULT_BUDGET_CONFIG, DEMO_BUDGET_SESSION } from "@ring-zero/mediation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run the demo research-agent session through the Cost/Token Budget interceptor.
 * `tokenBudget`, `costBudgetUsd`, and `strict` are the operator levers.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { tokenBudget?: number; costBudgetUsd?: number; strict?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const config = {
    tokenBudget: typeof body.tokenBudget === "number" && body.tokenBudget > 0 ? body.tokenBudget : DEFAULT_BUDGET_CONFIG.tokenBudget,
    costBudgetUsd: typeof body.costBudgetUsd === "number" && body.costBudgetUsd > 0 ? body.costBudgetUsd : DEFAULT_BUDGET_CONFIG.costBudgetUsd,
    strict: Boolean(body.strict),
  };
  const gw = new BudgetInterceptor(config);
  const decisions = gw.runSession(DEMO_BUDGET_SESSION);
  return NextResponse.json({ ok: true, config, decisions, finalTokens: gw.consumedTokens, finalCostUsd: gw.consumedCostUsd });
}
