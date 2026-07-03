import { governLangGraph, type LangGraphSpec } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compile an imported LangGraph-style graph to a Regent transition system and run
 * it under the deterministic kernel — the imported graph inherits the whole
 * binding path (guards, constraints, verifiers, fail-closed containment).
 */
export async function POST(req: Request): Promise<NextResponse> {
  let graph: LangGraphSpec;
  try {
    graph = (await req.json()) as LangGraphSpec;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  try {
    const trajectory = governLangGraph(graph);
    const released = trajectory.steps.some((s) => s.action.intent === "dispatch" && s.outcome === "applied");
    return NextResponse.json({ ok: true, released, trajectory });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
