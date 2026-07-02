import { listPipelines, PIPELINES, runOrchestration, type GovernanceLevel, type OrchestrationOverrides } from "@ring-zero/policy";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = new Set([1, 2, 3, 4]);

/** Manifest of available workflows (verticals, scenarios, default tiers). */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, pipelines: listPipelines() });
}

/**
 * Run the selected multi-agent workflow under the operator's live governance
 * overrides. Governance is enforced by the deterministic kernel — this route
 * only marshals the pipeline, per-agent tier (Θ) levels, kill switches, and
 * scenario into runOrchestration.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { pipeline?: string; tiers?: Record<string, number>; killed?: string[]; scenario?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "request body is not valid JSON" }, { status: 400 });
  }

  const pipeline = body.pipeline && PIPELINES[body.pipeline] ? body.pipeline : undefined;
  const tiers: Record<string, GovernanceLevel> = {};
  for (const [id, t] of Object.entries(body.tiers ?? {})) {
    if (TIERS.has(t)) tiers[id] = t as GovernanceLevel;
  }
  const killed = Array.isArray(body.killed) ? body.killed.filter((x): x is string => typeof x === "string") : [];
  const scenario = typeof body.scenario === "string" ? body.scenario : "clean";

  const overrides: OrchestrationOverrides = { pipeline, tiers, killed, scenario };
  try {
    return NextResponse.json({ ok: true, result: runOrchestration(overrides) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
