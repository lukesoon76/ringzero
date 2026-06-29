import { runOrchestration, type GovernanceLevel, type OrchestrationOverrides, type ScenarioId } from "@ring-zero/policy";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS = new Set([1, 2, 3, 4]);
const SCENARIOS = new Set(["clean", "stale-data", "off-allowlist", "double-count"]);

/**
 * Run the multi-agent workflow under the operator's live governance overrides.
 * Governance is enforced by the deterministic kernel — this route only marshals
 * the per-agent tier (Θ) levels, kill switches, and scenario into runOrchestration.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { tiers?: Record<string, number>; killed?: string[]; scenario?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "request body is not valid JSON" }, { status: 400 });
  }

  const tiers: Record<string, GovernanceLevel> = {};
  for (const [id, t] of Object.entries(body.tiers ?? {})) {
    if (TIERS.has(t)) tiers[id] = t as GovernanceLevel;
  }
  const killed = Array.isArray(body.killed) ? body.killed.filter((x): x is string => typeof x === "string") : [];
  const scenario = (SCENARIOS.has(body.scenario ?? "") ? body.scenario : "clean") as ScenarioId;

  const overrides: OrchestrationOverrides = { tiers, killed, scenario };
  try {
    return NextResponse.json({ ok: true, result: runOrchestration(overrides) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
