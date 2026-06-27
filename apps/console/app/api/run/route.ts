import { runWorkflowSpec, type WorkflowSpec } from "@ring-zero/policy";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compile and run a user-supplied workflow under the deterministic kernel.
 * Declarative guards/effects only — no user code reaches the binding path.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let spec: WorkflowSpec;
  try {
    spec = (await req.json()) as WorkflowSpec;
  } catch {
    return NextResponse.json({ ok: false, error: "request body is not valid JSON" }, { status: 400 });
  }
  try {
    const trajectory = runWorkflowSpec(spec);
    const released = trajectory.steps.some((s) => s.action.intent === "dispatch" && s.outcome === "applied");
    return NextResponse.json({ ok: true, released, trajectory });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
