import { runWorkflowSpec } from "@ring-zero/policy";
import { compileImportedWorkflow } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Universal workflow import: detect the format (Regent spec / LangGraph / CrewAI /
 * agent manifest), compile it to a governed WorkflowSpec, and run a governed
 * dry-run under the deterministic kernel. Declarative only — no imported code runs.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "request body is not valid JSON" }, { status: 400 });
  }
  try {
    const { format, workflow } = compileImportedWorkflow(body);
    const trajectory = runWorkflowSpec(workflow);
    const released = trajectory.steps.some((s) => s.action.intent === "dispatch" && s.outcome === "applied");
    return NextResponse.json({
      ok: true,
      format,
      tier: workflow.tier,
      states: workflow.states.length,
      transitions: workflow.transitions.length,
      released,
      trajectory,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
