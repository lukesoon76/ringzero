import { OVERSIGHT_MODES, oversightModeForAutonomy, type AutonomyLevel } from "@ring-zero/policy";
import { attestAutonomy, discoverAll } from "@ring-zero/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The human-oversight spectrum (HITL → HOTL → HIC → OOTL) plus, for each
 * discovered agent, the oversight mode its autonomy level implies. A pure
 * projection of the P1 inventory — the human's capacity follows the agent's
 * autonomy, and each mode is backed by real kernel enforcement.
 */
export function GET(): NextResponse {
  const auto = attestAutonomy(discoverAll());
  const agents = auto.agents.map((a) => ({
    id: a.agentId,
    name: a.name,
    source: a.source,
    autonomy: a.code,
    level: a.level,
    severity: a.severity,
    mode: a.level ? oversightModeForAutonomy(a.level as AutonomyLevel) : null,
  }));
  return NextResponse.json({ ok: true, modes: OVERSIGHT_MODES, agents });
}
