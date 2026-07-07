import { DEFAULT_FINANCE_CONFIG, DEMO_FINANCE_SESSION, FinanceRuntimeInterceptor } from "@ring-zero/mediation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run the demo wealth-advisory / payments session through the Financial Runtime
 * Interceptor. `sessionExposureCap` and `approveCritical` are the operator levers.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { sessionExposureCap?: number; approveCritical?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const cap = typeof body.sessionExposureCap === "number" && body.sessionExposureCap > 0 ? body.sessionExposureCap : DEFAULT_FINANCE_CONFIG.sessionExposureCap;
  const config = { ...DEFAULT_FINANCE_CONFIG, sessionExposureCap: cap };
  const gw = new FinanceRuntimeInterceptor(config);
  const decisions = gw.runSession(DEMO_FINANCE_SESSION, { approveCritical: Boolean(body.approveCritical) });
  return NextResponse.json({ ok: true, config, decisions, finalExposure: gw.exposure });
}
