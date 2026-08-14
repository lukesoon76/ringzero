import { runEvalSuite } from "@ring-zero/policy";
import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Run the deterministic assurance / red-team suite across all pipelines. The suite
 * is a side-effect-free computation, so any assurance viewer may load it; the
 * explicit "Run" re-trigger is gated on assurance:run in the UI.
 */
export function GET(): NextResponse {
  const s = getSession();
  if (!s || !s.permissions.includes("view:assurance")) {
    return NextResponse.json({ ok: false, error: "view:assurance permission required" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, report: runEvalSuite() });
}
