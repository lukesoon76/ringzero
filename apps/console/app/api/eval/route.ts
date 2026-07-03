import { runEvalSuite } from "@ring-zero/policy";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Run the deterministic assurance / red-team suite across all pipelines. */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, report: runEvalSuite() });
}
